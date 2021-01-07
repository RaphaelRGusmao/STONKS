/******************************************************************************/
/*                                   STONKS                                   */
/*                             Raphael R. Gusmão                              */
/*                                                                            */
/*                                  Storage                                   */
/******************************************************************************/

const csvWriter = require("csv-writer");
const fs = require("fs");
const Utils = require("./Utils");

/******************************************************************************/
/* Storage                                                                    */
/******************************************************************************/
module.exports = class Storage {
  static JSON_FOLDER = "storage/json/";
  static SHEETS_FOLDER = "storage/sheets/";
  static HISTORICAL_FOLDER = "historical/";

  /****************************************************************************/
  // Método privado. Carrega um arquivo JSON de nome "filename".
  // Output: JSON
  static #load = (filename) => {
    let path = Storage.JSON_FOLDER + filename + ".json";
    if (!fs.existsSync(path)) return null;
    return JSON.parse(fs.readFileSync(path));
  }

  /****************************************************************************/
  /* Companies / Empresas                                                     */
  /****************************************************************************/
  // [
  //   {
  //     "nome": string,
  //     "cvm_code": string,
  //     "tickers": [ string, ... ],
  //     "segmento": string
  //   },
  //   ...
  // ]

  // Salva o array "companies" como arquivo JSON.
  static save_companies = (companies) => {
    fs.writeFileSync(this.JSON_FOLDER + "companies.json", JSON.stringify(companies, null, 2), "utf-8");
    console.log("* Arquivo \"companies\" (json) salvo.");
  }

  // Carrega o array do arquivo "companies.json".
  static load_companies = () => {
    return this.#load("companies");
  }

  /****************************************************************************/
  /* Stocks / Ativos                                                          */
  /****************************************************************************/
  // [
  //   {
  //     "nome": string,
  //     "tipo": string,
  //     "segmento": string,
  //     "ticker": string
  //   },
  //   ...
  // ]

  // Salva o array "stocks" como arquivos JSON e CSV.
  static save_stocks = (stocks) => {
    const writer = csvWriter.createObjectCsvWriter({
      path: this.SHEETS_FOLDER + "stocks.csv",
      encoding : "utf8",
      header: [
        {id: "nome",     title: "Nome de Pregão"},
        {id: "tipo",     title: "Tipo"},
        {id: "segmento", title: "Segmento"},
        {id: "ticker",   title: "Ticker"}
      ]
    });
    writer.writeRecords(stocks);
    fs.writeFileSync(this.JSON_FOLDER + "stocks.json", JSON.stringify(stocks, null, 2), "utf-8");
    console.log("* Arquivos \"stocks\" (json / csv) salvos.");
  }

  // Carrega o array do arquivo "stocks.json".
  static load_stocks = () => {
    return this.#load("stocks");
  }

  /****************************************************************************/
  /* Trades / Negociações                                                     */
  /****************************************************************************/
  // [
  //   {
  //     "data": Date,
  //     "corretora": string,
  //     "negociacao": string,
  //     "compra_venda": "C"|"V",
  //     "tipo_mercado": string,
  //     "prazo": Date,
  //     "especificacao_do_titulo": string,
  //     "quantidade": int,
  //     "preco": float,
  //     "valor_operacao": float
  //   },
  //   ...
  // ]

  // Salva o array "trades" como arquivos JSON e CSV.
  static save_trades = (trades) => {
    trades.forEach(trade => {
      trade["data"] = Utils.format_date(trade["data"]);
      if (trade["prazo"]) trade["prazo"] = Utils.format_date(trade["prazo"]);
    });
    const writer = csvWriter.createObjectCsvWriter({
      path: this.SHEETS_FOLDER + "trades.csv",
      encoding : "utf8",
      header: [
        {id: "data",                    title: "Data Pregão"},
        {id: "corretora",               title: "Corretora"},
        {id: "negociacao",              title: "Negociação"},
        {id: "compra_venda",            title: "C/V"},
        {id: "tipo_mercado",            title: "Tipo Mercado"},
        {id: "prazo",                   title: "Prazo"},
        {id: "especificacao_do_titulo", title: "Especificacao do Título"},
        {id: "quantidade",              title: "Quantidade"},
        {id: "preco",                   title: "Preço"},
        {id: "valor_operacao",          title: "Valor Operação"}
      ]
    });
    writer.writeRecords(trades);
    fs.writeFileSync(this.JSON_FOLDER + "trades.json", JSON.stringify(trades, null, 2), "utf-8");
    console.log("* Arquivos \"trades\" (json / csv) salvos.");
  }

  // Carrega o array do arquivo "trades.json".
  static load_trades = () => {
    let trades = this.#load("trades");
    if (!trades) return null;
    trades.forEach(trade => {
      trade["data"] = Utils.parse_date(trade["data"]);
      if (trade["prazo"]) trade["prazo"] = Utils.parse_date(trade["prazo"]);
    });
    return trades;
  }

  /****************************************************************************/
  /* Taxes / Taxas                                                            */
  /****************************************************************************/
  // [
  //   {
  //     "data": Date,
  //     "corretora": string,
  //     "valor_liquido_das_operacoes": float,
  //     "taxa_de_liquidacao": float,
  //     "taxa_de_registro": float,
  //     "total_cblc": float,
  //     "taxa_de_termo_opcoes": float,
  //     "taxa_ana": float,
  //     "emolumentos": float,
  //     "total_bovespa_soma": float,
  //     "taxa_operacional": float,
  //     "execucao": float,
  //     "taxa_de_custodia": float,
  //     "impostos": float,
  //     "irrf_sobre_operacoes": float,
  //     "outros": float,
  //     "total_custos_despesas": float,
  //     "liquido": float,
  //     "taxa_total": float
  //   },
  //   ...
  // ]

  // Salva o array "taxes" como arquivos JSON e CSV.
  static save_taxes = (taxes) => {
    taxes.forEach(tax => {
      tax["data"] = Utils.format_date(tax["data"]);
    });
    const writer = csvWriter.createObjectCsvWriter({
      path: this.SHEETS_FOLDER + "taxes.csv",
      encoding : "utf8",
      header: [
        {id: "data",                        title: "Data"},
        {id: "corretora",                   title: "Corretora"},
        {id: "valor_liquido_das_operacoes", title: "Valor Líquido das Operações"},
        {id: "taxa_de_liquidacao",          title: "Taxa de Liquidação"},
        {id: "taxa_de_registro",            title: "Taxa de Registro"},
        {id: "total_cblc",                  title: "Total CBLC"},
        {id: "taxa_de_termo_opcoes",        title: "Taxa de Termo/Opções"},
        {id: "taxa_ana",                    title: "Taxa A.N.A."},
        {id: "emolumentos",                 title: "Emolumentos"},
        {id: "total_bovespa_soma",          title: "Total Bovespa / Soma"},
        {id: "taxa_operacional",            title: "Taxa Operacional"},
        {id: "execucao",                    title: "Execução"},
        {id: "taxa_de_custodia",            title: "Taxa de Custódia"},
        {id: "impostos",                    title: "Impostos"},
        {id: "irrf_sobre_operacoes",        title: "I.R.R.F. sobre Operações"},
        {id: "outros",                      title: "Outros"},
        {id: "total_custos_despesas",       title: "Total Custos / Despesas"},
        {id: "liquido",                     title: "Líquido"},
        {id: "taxa_total",                  title: "Taxa Total"}
      ]
    });
    writer.writeRecords(taxes);
    fs.writeFileSync(this.JSON_FOLDER + "taxes.json", JSON.stringify(taxes, null, 2), "utf-8");
    console.log("* Arquivos \"taxes\" (json / csv) salvos.");
  }

  // Carrega o array do arquivo "taxes.json".
  static load_taxes = () => {
    let taxes = this.#load("taxes");
    if (!taxes) return null;
    taxes.forEach(tax => {
      tax["data"] = Utils.parse_date(tax["data"]);
    });
    return taxes;
  }

  /****************************************************************************/
  /* Tickers / Códigos dos ativos                                             */
  /****************************************************************************/
  // [ "ticker", ... ]

  // Salva o array "tickers" como arquivos JSON e CSV.
  static save_tickers = (tickers) => {
    const writer = csvWriter.createArrayCsvWriter({
      path: this.SHEETS_FOLDER + "tickers.csv",
      encoding : "utf8",
      header: ["Ticker"]
    });
    writer.writeRecords(tickers.map(ticker => [ticker]));
    fs.writeFileSync(this.JSON_FOLDER + "tickers.json", JSON.stringify(tickers, null, 2), "utf-8");
    console.log("* Arquivos \"tickers\" (json / csv) salvos.");
  }

  // Carrega o array do arquivo "tickers.json".
  static load_tickers = () => {
    return this.#load("tickers");
  }

  /****************************************************************************/
  /* Positions / Posições                                                     */
  /****************************************************************************/
  // [
  //   {
  //     "data": Date,
  //     "aportes": float,
  //     "resgates": float,
  //     "ticker": int,
  //     ...
  //   },
  //   ...
  // ]

  // Salva o array "positions" como arquivos JSON e CSV.
  static save_positions = (positions, tickers) => {
    positions.forEach(position => {
      position["data"] = Utils.format_date(position["data"]);
    });
    let headers = [...tickers].map(ticker => ({id:ticker, title:ticker})).reverse();
    const writer = csvWriter.createObjectCsvWriter({
      path: this.SHEETS_FOLDER + "positions.csv",
      encoding : "utf8",
      header: [
        {id: "data",     title: "Data"},
        {id: "aportes",  title: "Aportes"},
        {id: "resgates", title: "Resgates"},
        ...headers
      ]
    });
    writer.writeRecords(positions);
    fs.writeFileSync(this.JSON_FOLDER + "positions.json", JSON.stringify(positions, null, 2), "utf-8");
    console.log("* Arquivos \"positions\" (json / csv) salvos.");
  }

  // Carrega o array do arquivo "positions.json".
  static load_positions = () => {
    let positions = this.#load("positions");
    if (!positions) return null;
    positions.forEach(position => {
      position["data"] = Utils.parse_date(position["data"]);
    });
    return positions;
  }

  /****************************************************************************/
  /* Ranges / Períodos                                                        */
  /****************************************************************************/
  // {
  //   ticker: [
  //     { "start": Date, "end": Date|null },
  //     ...
  //   ],
  //   ...
  // }

  // Salva o dict "stocks_ranges" como arquivo JSON.
  static save_ranges = (stocks_ranges) => {
    for (let ticker of Object.keys(stocks_ranges)) {
      stocks_ranges[ticker].forEach(range => {
        range["start"] = Utils.format_date(range["start"]);
        range["end"] = range["end"]? Utils.format_date(range["end"]) : "";
      });
    }
    fs.writeFileSync(this.JSON_FOLDER + "ranges.json", JSON.stringify(stocks_ranges, null, 2), "utf-8");
    console.log("* Arquivo \"ranges\" (json) salvo.");
  }

  // Carrega o dict do arquivo "ranges.json".
  static load_ranges = () => {
    let stocks_ranges = this.#load("ranges");
    if (!stocks_ranges) return null;
    for (let ticker of Object.keys(stocks_ranges)) {
      stocks_ranges[ticker].forEach(range => {
        range["start"] = Utils.parse_date(range["start"]);
        range["end"] = range["end"]? Utils.parse_date(range["end"]) : null;
      });
    }
    return stocks_ranges;
  }

  /****************************************************************************/
  /* Historical / Histórico                                                   */
  /****************************************************************************/
  // {
  //   "ranges": [
  //     { "start": Date, "end": Date|null },
  //     ...
  //   ],
  //   "historical": [
  //     {
  //       "data": Date,
  //       "fechamento": float,
  //       "variacao": float,
  //       "variacao_%": float,
  //       "abertura": float,
  //       "maxima": float,
  //       "minima": float,
  //       "volume": int
  //     },
  //     ...
  //   ]
  // }

  // Salva o array "historical" como um arquivo CSV e  um  dict  com  os  arrays
  // "ranges" e "historical" como um arquivo JSON. Ambos os arquivos são  salvos
  // com o nome "ticker".
  static save_historical = (ticker, ranges, historical) => {
    ticker = ticker.replace("/", "-");
    ranges.forEach(range => {
      range["start"] = Utils.format_date(range["start"]);
      range["end"] = Utils.format_date(range["end"]);
    });
    historical.forEach(row => {
      row["data"] = Utils.format_date(row["data"]);
    });
    const writer = csvWriter.createObjectCsvWriter({
      path: this.SHEETS_FOLDER + this.HISTORICAL_FOLDER + ticker + ".csv",
      encoding : "utf8",
      header: [
        {id: "data",       title: "Data"},
        {id: "fechamento", title: "Fechamento"},
        {id: "variacao",   title: "Variação"},
        {id: "variacao_%", title: "Variação (%)"},
        {id: "abertura",   title: "Abertura"},
        {id: "maxima",     title: "Máxima"},
        {id: "minima",     title: "Mínima"},
        {id: "volume",     title: "Volume"},
      ]
    });
    writer.writeRecords(historical);
    fs.writeFileSync(
      this.JSON_FOLDER + this.HISTORICAL_FOLDER + ticker + ".json",
      JSON.stringify({
        "ranges": ranges,
        "historical": historical
      }, null, 2), "utf-8"
    );
    console.log("* Arquivos \"" + this.HISTORICAL_FOLDER + ticker + "\" (json / csv) salvos.");
  }

  // Carrega o dict do arquivo de histórico de nome "ticker".
  static load_historical = (ticker) => {
    ticker = ticker.replace("/", "-");
    let file = this.#load(this.HISTORICAL_FOLDER + ticker);
    if (!file) return [null, null];
    let [saved_ranges, saved_historical] = Object.values(file);
    saved_ranges.forEach(range => {
      range["start"] = Utils.parse_date(range["start"]);
      range["end"] = Utils.parse_date(range["end"]);
    });
    saved_historical.forEach(row => {
      row["data"] = Utils.parse_date(row["data"]);
    });
    return [saved_ranges, saved_historical];
  }

  /****************************************************************************/
  /* Portfolio / Carteira de Investimentos                                    */
  /****************************************************************************/
  // [
  //   {
  //     "data": Date,
  //     "aportes": float,
  //     "resgates": float,
  //     "total": float,
  //     "ticker": float,
  //     ...
  //   },
  //   ...
  // ]

  // Salva o array "portfolio" como arquivos JSON e CSV.
  static save_portfolio = (portfolio, tickers) => {
    portfolio.forEach(p => {
      p["data"] = Utils.format_date(p["data"]);
    });
    let headers = [...tickers].map(ticker => ({id:ticker, title:ticker})).reverse();
    const writer = csvWriter.createObjectCsvWriter({
      path: this.SHEETS_FOLDER + "portfolio.csv",
      encoding : "utf8",
      header: [
        {id: "data",     title: "Data"},
        {id: "aportes",  title: "Aportes"},
        {id: "resgates", title: "Resgates"},
        {id: "total",    title: "Total"},
        ...headers
      ]
    });
    writer.writeRecords(portfolio);
    fs.writeFileSync(this.JSON_FOLDER + "portfolio.json", JSON.stringify(portfolio, null, 2), "utf-8");
    console.log("* Arquivos \"portfolio\" (json / csv) salvos.");
  }

  // Carrega o array do arquivo "portfolio.json".
  static load_portfolio = () => {
    let portfolio = this.#load("portfolio");
    if (!portfolio) return null;
    portfolio.forEach(p => {
      p["data"] = Utils.parse_date(p["data"]);
    });
    return portfolio;
  }
}

/******************************************************************************/
