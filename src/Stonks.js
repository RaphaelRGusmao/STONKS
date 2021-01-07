/******************************************************************************/
/*                                   STONKS                                   */
/*                             Raphael R. Gusmão                              */
/*                                                                            */
/*                                   Stonks                                   */
/******************************************************************************/

const Config = require("./Config");
const Storage = require("./Storage");
const Utils = require("./Utils");
const Scraper = require("./Scraper");

/******************************************************************************/
/* Stonks                                                                     */
/******************************************************************************/
module.exports = class Stonks {
  // Tipos de ativo
  static STOCK_TYPE = {
    "1": "ON DIR",
    "2": "PN DIR",
    "3": "ON",
    "4": "PN",
    "5": "PNA",
    "6": "PNB",
    "7": "PNC",
    "8": "PND",
    "9": "ON REC",
    "10": "PN REC",
    "11": "UNT"
  };

  /****************************************************************************/
  // Obtém o tipo do ativo de acordo com o seu "ticker".
  // Output: string
  static get_stock_type = (ticker) => {
    let type = ticker.slice(4);
    if (type.endsWith("B")) type = type.slice(0, -1);
    type = this.STOCK_TYPE[type] || "";
    return type;
  }

  /****************************************************************************/
  // Cria um array de ativos "stocks" com base no array de empresas "companies".
  // Output: [
  //   {
  //     "nome": string,
  //     "tipo": string,
  //     "segmento": string,
  //     "ticker": string
  //   },
  //   ...
  // ]
  static get_stocks = (companies) => {
    let stocks = [];
    for (let company of companies) {
      for (let ticker of company["tickers"]) {
        stocks.push({
          nome: company["nome"],
          tipo: this.get_stock_type(ticker),
          segmento: company["segmento"],
          ticker: ticker
        });
      }
    }

    stocks.sort((a, b) => (
      a["nome"].localeCompare(b["nome"]) ||
      b["tipo"].localeCompare(a["tipo"]) ||
      a["ticker"].localeCompare(b["ticker"])
    ));

    return stocks;
  }

  /****************************************************************************/
  // Adiciona, em cada trade do array de "trades", o respectivo ticker do  ativo
  // negociado. Além disso, retorna todos os tickers utilizados.
  // Output: [ "ticker", ... ]
  static add_tickers = (trades, stocks) => {
    let tickers_pd = {};
    for (let trade of trades) {
      if (tickers_pd.hasOwnProperty(trade["especificacao_do_titulo"])) {
        trade["ticker"] = tickers_pd[trade["especificacao_do_titulo"]];
      } else {
        if (trade["tipo_mercado"].includes("OPCAO")) {
          let ticker = trade["especificacao_do_titulo"].split(" ")[0];
          let prazo_text = Utils.format_date_short(trade["prazo"]).slice(3);
          trade["ticker"] = ticker + " " + prazo_text;
        } else {
          for (let stock of stocks) {
            if (trade["especificacao_do_titulo"].startsWith(stock["nome"] + " " + stock["tipo"])) {
              trade["ticker"] = stock["ticker"];
              break;
            }
          }
        }
        tickers_pd[trade["especificacao_do_titulo"]] = trade["ticker"];
      }
    }
    return [...new Set(Object.values(tickers_pd))];
  }

  /****************************************************************************/
  // Junta os ranges do array "ranges" que estão próximos um do  outro  com  uma
  // diferença de no máximo "Config.DAYS_PER_PAGE" dias. O resultado disso é  um
  // array de tamanho igual ou menor que o original. Isso é util para otimizar a
  // busca pelos preços dos ativos na internet.
  // Output: [
  //   { "start": Date, "end": Date },
  //   ...
  // ]
  static compact_ranges = (ranges) => {
    let compacted = [...ranges];
    for (let i = 1; i < compacted.length; i++) {
      if (Utils.diff_days(compacted[i-1]["end"], compacted[i]["start"]) <= Config.DAYS_PER_PAGE) {
        compacted[i-1] = {start:compacted[i-1]["start"], end:compacted[i]["end"]};
        compacted.splice(i--, 1);
      }
    }
    return compacted;
  }

  /****************************************************************************/
  // Retorna um array com os ranges de datas que estão presentes em "ranges" mas
  // não estão em "saved_ranges". Ou seja, retorna  apenas  os  ranges  que  não
  // foram salvos ainda.
  // Output: [
  //   { "start": Date, "end": Date },
  //   ...
  // ]
  static get_ranges_to_scrap = (saved_ranges, ranges) => {
    let ranges_to_scrap = [...ranges];

    if (saved_ranges.length > 0) {
      for (let i = 0, j = 0; i < ranges_to_scrap.length; i++) {
        while (j < saved_ranges.length && saved_ranges[j]["end"].getTime() < ranges_to_scrap[i]["start"].getTime()) j++;
        if (j == saved_ranges.length) break;

        let prev = new Date(+saved_ranges[j]["start"] - Utils.ONE_DAY);
        let next = new Date(+saved_ranges[j]["end"] + Utils.ONE_DAY);

        if (saved_ranges[j]["start"].getTime() > ranges_to_scrap[i]["start"].getTime()) {
          if (saved_ranges[j]["end"].getTime() < ranges_to_scrap[i]["end"].getTime()) {
            ranges_to_scrap.splice(i+1, 0, {start:next, end:new Date(ranges_to_scrap[i]["end"])});
          }
          if (prev.getTime() < ranges_to_scrap[i]["end"].getTime()) {
            ranges_to_scrap[i] = {start:ranges_to_scrap[i]["start"], end:prev};
          }
        } else if (saved_ranges[j]["end"].getTime() < ranges_to_scrap[i]["end"].getTime()) {
          ranges_to_scrap[i] = {start:next, end:ranges_to_scrap[i]["end"]}; i--;
        } else {
          ranges_to_scrap.splice(i--, 1);
        }
      }
    }

    return ranges_to_scrap;
  }

  /****************************************************************************/
  // Verifica se os arrays de ranges são iguais.
  // Output: boolean
  static are_ranges_equal = (ranges1, ranges2) => {
    if (ranges1.length != ranges2.length) return false;
    for (let i = 0; i < ranges1.length; i++) {
      if (ranges1[i]["start"].getTime() != ranges2[i]["start"].getTime()
       || ranges1[i]["end"].getTime() != ranges2[i]["end"].getTime()) return false;
    }
    return true;
  }

  /****************************************************************************/
  // Combina dois arrays de ranges de modo que, ao final, todos os ranges  sejam
  // disjuntos.
  // Output: [
  //   { "start": Date, "end": Date },
  //   ...
  // ]
  static merge_ranges = (ranges1, ranges2) => {
    let merged = [];

    let points = [
      ...ranges1.flatMap(d => Object.entries(d).map(p => ({[p[0]]:p[1]}))),
      ...ranges2.flatMap(d => Object.entries(d).map(p => ({[p[0]]:p[1]})))
    ];
    points.sort((a, b) => Object.values(a)[0] - Object.values(b)[0]);

    let depth = 0;
    for (let point of points) {
      let [type, date] = Object.entries(point)[0];
      if (type == "start") {
        depth++;
        if (depth == 1) {
          if (merged.length) {
            let last_date = merged[merged.length - 1]["end"];
            if (date.getTime() == last_date.getTime()
             || date.getTime() == last_date.getTime() + Utils.ONE_DAY) continue;
          }
          merged.push({start:date, end:null});
        }
      } else {
        depth--;
        if (depth == 0) {
          merged[merged.length - 1]["end"] = date;
        }
      }
    }

    return merged;
  }

  /****************************************************************************/
  // Combina dois arrays de históricos.
  // Output: [
  //   {
  //     "data": Date,
  //     "fechamento": float,
  //     "variacao": float,
  //     "variacao_%": float,
  //     "abertura": float,
  //     "maxima": float,
  //     "minima": float,
  //     "volume": int
  //   },
  //   ...
  // ]
  static merge_historicals = (historical1, historical2) => {
    let merged = [];

    let i = 0, j = 0;
    while (i < historical1.length && j < historical2.length) {
      if (historical1[i]["data"].getTime() < historical2[j]["data"].getTime()) {
        merged.push(historical1[i++]);
      } else if (historical1[i]["data"].getTime() > historical2[j]["data"].getTime()) {
        merged.push(historical2[j++]);
      } else {
        merged.push(historical1[i++]);
        j++;
      }
    }
    while (i < historical1.length) merged.push(historical1[i++]);
    while (j < historical2.length) merged.push(historical2[j++]);

    return merged;
  }

  /****************************************************************************/
  // Extrai da internet o  histórico  de  todos  os  ativos  presentes  no  dict
  // "stocks_ranges" nos períodos especificados  e  salva.  Caso  já  exista  um
  // histórico salvo, extrai somente o necessario para completar os períodos.
  static download_historicals = async (stocks_ranges) => {
    for (let ticker of Object.keys(stocks_ranges)) {
      let ranges = stocks_ranges[ticker].map(range => Object.assign({}, range));
      if (!ranges[ranges.length - 1]["end"]) {
        ranges[ranges.length - 1]["end"] = new Date(Utils.today() - Utils.ONE_DAY);
      }

      let [saved_ranges, saved_historical] = Storage.load_historical(ticker);

      if (saved_historical) {
        let merged_ranges = this.merge_ranges(saved_ranges, ranges);
        if (this.are_ranges_equal(saved_ranges, merged_ranges)) continue;
        merged_ranges = this.compact_ranges(merged_ranges);
        let ranges_to_scrap = this.get_ranges_to_scrap(saved_ranges, merged_ranges);
        ranges_to_scrap = this.compact_ranges(ranges_to_scrap);

        let historical = await Scraper.scrape_historical(ticker, ranges_to_scrap);
        historical = this.merge_historicals(saved_historical, historical);

        Storage.save_historical(ticker, merged_ranges, historical);
      } else {
        let ranges_to_scrap = this.compact_ranges(ranges);
        let historical = await Scraper.scrape_historical(ticker, ranges_to_scrap);

        Storage.save_historical(ticker, ranges_to_scrap, historical);
      }
      console.log();
    }
  }

  /****************************************************************************/
  // Retorna a data de vencimento de uma opção. O mês e o ano de  vencimento  da
  // opção são passados como parâmetro pela variável "text" no seguinte formato:
  // "mm/yy". Uma opção sempre vence na terceira segunda-feira de seu respectivo
  // mês de vencimento. O dict "expiration_pd" é  utilizado  para  armazenar  os
  // valores já calculados pela função, atuando como uma espécie de cache.
  // Output: Date
  static #expiration_pd = {};
  static get_expiration_date = (text) => {
    if (this.#expiration_pd.hasOwnProperty(text)) {
      return this.#expiration_pd[text];
    }
    let [month, year] = text.split("/");
    let date = new Date("20"+year, month-1, 1);
    let expiration = date.getDate() + 22 - date.getDay();
    date.setDate(expiration);
    return this.#expiration_pd[text] = date;
  }

  /****************************************************************************/
  // Obtém todas as posições de carteira existentes  ao  longo  do  tempo.  Cada
  // posição é composta de uma "data" e de todos os  "tickers"  dos  ativos  que
  // estavam na carteira no momento, juntamente com a quantidade de cada  ativo.
  // (quantidade negativa indica posição short). Além disso, cada posição possui
  // valores chamados "aportes" e "resgates", que correspondem, respectivamente,
  // às somas de todos os aportes e  de  todos  os  resgates  realizados  até  a
  // "data". O array de "positions"  contém  apenas  as  posições  que  sofreram
  // alteração na respectiva "data".
  // Output: [
  //   {
  //     "data": Date,
  //     "aportes": float,  // Aportes até a data
  //     "resgates": float, // Resgates até a data
  //     "ticker": int      // Quantidade
  //     ...
  //   },
  //   ...
  // ]
  static calculate_positions = (trades) => {
    if (trades.length == 0) return [];

    // Sub-função que verifica se algum prazo de vencimento já passou
    const verify_expirations_until = (date) => {
      for (let i = 0; i < expirations.length; i++) {
        if (expirations[i] <= date.getTime()) {
          position = Object.assign({}, last_position, { data: new Date(expirations[i]) });
          for (let ticker of Object.keys(position)) {
            let expiration = ticker.split(" ")[1];
            if (!expiration) continue;
            expiration = this.get_expiration_date(expiration);
            if (expiration.getTime() == expirations[i]) { // Opção vencida
              delete position[ticker];
            }
          }
          positions.push(position);
          last_position = position;
          expirations.splice(i--, 1);
        } else break;
      }
    }

    let positions = [{data: trades[0]["data"], aportes: 0, resgates: 0}];
    let position = null;
    let last_position = null;
    let expirations = [];

    for (let trade of trades) {
      position = {};
      last_position = positions[positions.length - 1];

      verify_expirations_until(trade["data"]);

      if (trade["data"].getTime() == last_position["data"].getTime()) {
        // Mesmo dia de trade
        position = last_position;
      } else {
        // Novo dia de trade
        position = Object.assign({}, last_position, {data: trade["data"]});
        positions.push(position);
      }

      let value = 0;
      if (trade["compra_venda"] == "C") {
        value = trade["quantidade"];
        position["aportes"] = parseFloat((position["aportes"] + trade["valor_operacao"]).toFixed(2));
      } else {
        value = -trade["quantidade"];
        position["resgates"] = parseFloat((position["resgates"] + trade["valor_operacao"]).toFixed(2));
      }

      if (position.hasOwnProperty(trade["ticker"])) { // Ativo existente
        position[trade["ticker"]] += value;

        // Ativo zerado
        if (position[trade["ticker"]] == 0) delete position[trade["ticker"]];
      } else { // Ativo novo
        position[trade["ticker"]] = value;
        if (trade["prazo"] && !expirations.includes(trade["prazo"].getTime())) {
          // Novo prazo de vencimento
          expirations.push(trade["prazo"].getTime());
          expirations.sort();
        }
      }
    }

    last_position = positions[positions.length - 1];
    verify_expirations_until(Utils.today());

    return positions;
  }

  /****************************************************************************/
  // Obtém as datas de início e de término dos períodos em que cada ativo  ficou
  // na carteira de investimentos. Isso é utilizado para extrair da internet  os
  // preços dos ativos apenas durante esses períodos. Caso  o  ativo  não  tenha
  // sido removido da carteira ainda, a data de término será "null".
  // Output: {
  //   ticker: [
  //     { "start": Date, "end": Date|null },
  //     ...
  //   ],
  //   ...
  // }
  static get_stocks_ranges = (positions) => {
    let stocks_ranges = {};

    for (let i in positions) {
      let last_position = positions[+i - 1];
      let position = positions[i];
      let next_position = positions[+i + 1];

      for (let ticker of Object.keys(position)) {
        if (["data", "aportes", "resgates"].includes(ticker)) continue;

        if (stocks_ranges.hasOwnProperty(ticker)) {
          if (last_position && !last_position.hasOwnProperty(ticker)) {
            stocks_ranges[ticker].push({start:position["data"], end:null});
          }
        } else {
          stocks_ranges[ticker] = [{start:position["data"], end:null}];
        }
        if (next_position && !next_position.hasOwnProperty(ticker)) {
          stocks_ranges[ticker][stocks_ranges[ticker].length - 1]["end"] = next_position["data"];
        }
      }
    }

    return stocks_ranges;
  }

  /****************************************************************************/
  // Calcula a  evolução  da  carteira  de  investimentos  ao  longo  do  tempo.
  // Cada elemento do array "portfolio" é composto de uma "data" e de  todos  os
  // "tickers" dos ativos que estavam na carteira no momento, juntamente  com  o
  // valor (quantidade * preço) em reais de cada  ativo  (valor negativo  indica
  // posição short). Há também o valor "total", com a soma dos valores de  todos
  // os ativos. Além disso, cada elemento possui valores  chamados  "aportes"  e
  // "resgates", que correspondem, respectivamente, às somas de todos os aportes
  // e de todos os resgates realizados até a  "data".  Diferentemente  do  array
  // "positions", o array "portfolio" possui registro de todas as datas desde  o
  // início dos investimentos até o dia atual.
  // Output: [
  //   {
  //     "data": Date,
  //     "aportes": float,  // Aportes até a data
  //     "resgates": float, // Resgates até a data
  //     "total": float,    // Valor total da carteira
  //     "ticker": float,   // Quantidade * Preço de fechamento do dia
  //     ...
  //   },
  //   ...
  // ]
  static calculate_portfolio = (positions) => {
    let portfolio = [];
    let saved = {};
    let historical_index = {};
    let today = Utils.today();

    // Percorre as posições
    for (let i = 1; i <= positions.length; i++) {
      let date = positions[i-1]["data"];
      let aportes = positions[i-1]["aportes"];
      let resgates = positions[i-1]["resgates"];

      // Percorre todas as datas até hoje
      while ((i < positions.length && date.getTime() < positions[i]["data"].getTime())
      || (i == positions.length && date.getTime() <= today.getTime())) {
        let day_portfolio = { data: date, aportes: aportes, resgates: resgates, total: 0 };

        // Percorre os tickers da posição
        for (let ticker of Object.keys(positions[i-1])) {
          if (["data", "aportes", "resgates"].includes(ticker)) continue;

          // Carrega o arquivo apenas na primeira vez em que o ticker é encontrado
          let [saved_dates, saved_historical] = [null, null];
          if (saved.hasOwnProperty(ticker)) [saved_dates, saved_historical] = saved[ticker];
          else [saved_dates, saved_historical] = saved[ticker] = Storage.load_historical(ticker);

          let value = "?";

          // Caso exista um histórico salvo
          if (saved_historical) {
            let index = ++historical_index[ticker] || 0;

            // Procura a posição (index) da data no histórico
            let found = true;
            if (index < saved_historical.length) {
              if (saved_historical[index]["data"].getTime() != date.getTime()) {
                index = 0;
                let j = 0;
                while (j < saved_dates.length && saved_dates[j]["end"].getTime() < date.getTime()) {
                  index += Utils.diff_days(saved_dates[j]["start"], saved_dates[j]["end"]) + 1;
                  j++;
                }
                if (j < saved_dates.length && saved_dates[j]["start"].getTime() <= date.getTime()) {
                  index += Utils.diff_days(saved_dates[j]["start"], date);
                } else found = false;
              }
              historical_index[ticker] = index;
            } else found = false;

            if (found) { // Se a data estiver presente no histórico
              value = parseFloat((positions[i-1][ticker] * saved_historical[index]["fechamento"]).toFixed(2));
              day_portfolio["total"] = parseFloat((day_portfolio["total"] + value).toFixed(2));
            }
          }
          day_portfolio[ticker] = value;
        }
        if (Object.values(day_portfolio).includes("?")) {
          day_portfolio["total"] = "?";
        }
        portfolio.push(day_portfolio);
        date = new Date(+date + Utils.ONE_DAY);
      }
    }

    return portfolio;
  }

  /****************************************************************************/
  // Obtém o rendimento "profit" e a rentabilidade "profitability"  da  carteira
  // de investimentos "portfolio" entre as datas "from_date" e "to_date".
  // Output: [ float|"?", float|"?" ]
  static get_profit = (portfolio, range) => {
    if (range["from"].getTime() < portfolio[0]["data"].getTime()) {
      range["from"] = portfolio[0]["data"];
    }
    if (portfolio[portfolio.length - 1]["data"].getTime() < range["to"].getTime()) {
      range["to"] = portfolio[portfolio.length - 1]["data"];
    }

    let from_index = Utils.diff_days(portfolio[0]["data"], range["from"]);
    let to_index = Utils.diff_days(portfolio[0]["data"], range["to"]);

    if (to_index <= from_index) return ["?", "?"];

    let profit = (
      portfolio[to_index]["total"] - portfolio[from_index]["total"]
      - portfolio[to_index]["aportes"] + portfolio[from_index]["aportes"]
      + portfolio[to_index]["resgates"] - portfolio[from_index]["resgates"]
    );
    profit = !isNaN(profit)? parseFloat(profit.toFixed(2)) : "?";

    let profitability = 100*profit / (
      portfolio[from_index]["total"]
      + portfolio[to_index]["aportes"] - portfolio[from_index]["aportes"]
    );
    profitability = !isNaN(profitability)? parseFloat(profitability.toFixed(2)) : "?";

    return [profit, profitability];
  }

  /****************************************************************************/
  // Exibe o status (diário, mensal,  anual  e  total)  dos  rendimentos  e  das
  // rentabilidades nominais da carteira de investimentos.
  static show_status = (positions, portfolio) => {
    console.log("───────────────────────────────────────────────────────────────┐");
    // Penúltimo dia de investimento registrado no array "portfolio". É  chamado
    // de "yesterday" para facilitar a leitura, mas pode não ser realmente o dia
    // de ontem, caso o arquivo "portfolio.json" esteja desatualizado.
    let yesterday_portfolio = portfolio[portfolio.length - 2];
    let yesterday = yesterday_portfolio["data"];

    // Rendimento e Rentabilidade do dia
    let before_yesterday = new Date(yesterday - Utils.ONE_DAY);
    let daily = { from: before_yesterday, to: yesterday };
    let [day_profit, day_profitability] = this.get_profit(portfolio, daily);
    console.log("Rendimento e Rentabilidade do dia ("
      + Utils.format_date(daily["from"]) + " - "
      + Utils.format_date(daily["to"]) + "):");
    console.log("  " + Utils.format_money(day_profit) + " ("+day_profitability+" %)");
    console.log();

    // Rendimento e Rentabilidade do mês
    let beginning_of_the_month = new Date(yesterday);
    beginning_of_the_month.setDate(0);
    let monthly = { from: beginning_of_the_month, to: yesterday };
    let [month_profit, month_profitability] = this.get_profit(portfolio, monthly);
    console.log("Rendimento e Rentabilidade do mês ("
      + Utils.format_date(monthly["from"]) + " - "
      + Utils.format_date(monthly["to"]) + "):");
    console.log("  " + Utils.format_money(month_profit) + " ("+month_profitability+" %)");
    console.log();

    // Rendimento e Rentabilidade do ano
    let beginning_of_the_year = new Date(yesterday);
    beginning_of_the_year.setMonth(0); beginning_of_the_year.setDate(0);
    let annual = { from: beginning_of_the_year, to: yesterday };
    let [year_profit, year_profitability] = this.get_profit(portfolio, annual);
    console.log("Rendimento e Rentabilidade do ano ("
      + Utils.format_date(annual["from"]) + " - "
      + Utils.format_date(annual["to"]) + "):");
    console.log("  " + Utils.format_money(year_profit) + " ("+year_profitability+" %)");
    console.log();

    // Rendimento e Rentabilidade total
    let total = { from: portfolio[0]["data"], to: yesterday };
    let [total_profit, total_profitability] = this.get_profit(portfolio, total);
    console.log("Rendimento e Rentabilidade total ("
      + Utils.format_date(total["from"]) + " - "
      + Utils.format_date(total["to"]) + "):");
    console.log("  " + Utils.format_money(total_profit) + " ("+total_profitability+" %)");
    console.log();

    // Carteira de Investimentos
    console.log("────────────────────────────────────────────────────────────────");
    let last_position = positions[positions.length - 1];
    if (last_position["data"].getTime() > yesterday.getTime()) {
      last_position = positions[positions.length - 2];
    }
    let table = [];
    Object.keys(yesterday_portfolio).forEach(ticker => {
      if (!["data", "aportes", "resgates", "total"].includes(ticker)) {
        table.push({
          "Ticker": ticker,
          "Quantidade": last_position[ticker],
          "Preço": Utils.format_money(yesterday_portfolio[ticker] / last_position[ticker]),
          "Valor": Utils.format_money(yesterday_portfolio[ticker]),
          "%": parseFloat((100*yesterday_portfolio[ticker] / yesterday_portfolio["total"]).toFixed(2)) || "?"
        });
      }
    });
    table.sort((a, b) => b["%"] - a["%"]);
    console.log("Carteira de Investimentos ("
      + Utils.format_date(yesterday_portfolio["data"]) + "):");
    console.table(table);
    console.log("\nValor total:");
    console.log("  " + Utils.format_money(yesterday_portfolio["total"]));
    console.log("\nAportes até o momento:");
    console.log("  " + Utils.format_money(yesterday_portfolio["aportes"]));
    console.log("\nResgates até o momento:");
    console.log("  " + Utils.format_money(yesterday_portfolio["resgates"]));
    console.log();
    console.log("───────────────────────────────────────────────────────────────┘\n");
  }
}

/******************************************************************************/
