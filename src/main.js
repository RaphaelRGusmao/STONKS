/******************************************************************************/
/*                                   STONKS                                   */
/*                             Raphael R. Gusmão                              */
/*                                                                            */
/*                                    Main                                    */
/******************************************************************************/

const Config = require("./Config");
const Storage = require("./Storage");
const Utils = require("./Utils");
const Notes = require("./Notes");
const Stonks = require("./Stonks");
const Scraper = require("./Scraper");

/******************************************************************************/
// 1. Baixa a lista de ativos listados na Bolsa de Valores Brasileira.
// Storage|Web => companies, stocks
run_stocks = async () => {
  let companies = Storage.load_companies();
  let stocks = Storage.load_stocks();

  if (!stocks) {
    if (!companies) {
      companies = await Scraper.scrape_companies();
      Storage.save_companies(companies);
    }
    stocks = Stonks.get_stocks(companies);
    Storage.save_stocks(stocks);
  }

  return [companies, stocks];
}

/******************************************************************************/
// 2. Extrai as informações de trades e taxas de cada Nota de Negociação.
// stocks, pdfs => trades, taxes, tickers
run_notes = async () => {
  let stocks = Storage.load_stocks();
  if (!stocks) Utils.exit_with_msg("Arquivo \"stocks.json\" não encontrado!");

  let [trades, taxes] = await Notes.parse_folder(Config.NOTES_FOLDER, Config.PASSWORDS);
  let tickers = Stonks.add_tickers(trades, stocks);

  Storage.save_trades(trades);
  Storage.save_taxes(taxes);
  Storage.save_tickers(tickers);
}

/******************************************************************************/
// 3. Calcula todas as posições de carteira existentes ao longo do tempo.
// tickers, trades => positions, ranges
run_positions = () => {
  let tickers = Storage.load_tickers();
  if (!tickers) Utils.exit_with_msg("Arquivo \"tickers.json\" não encontrado!");

  let trades = Storage.load_trades();
  if (!trades) Utils.exit_with_msg("Arquivo \"trades.json\" não encontrado!");

  let positions = Stonks.calculate_positions(trades);
  let ranges = Stonks.get_stocks_ranges(positions);

  Storage.save_positions(positions, tickers);
  Storage.save_ranges(ranges);
}

/******************************************************************************/
// 4. Baixa o histórico de preços de todos os ativos que foram negociados.
// ranges, Storage|Web => historicals
run_prices = async () => {
  let stocks_ranges = Storage.load_ranges();
  if (!stocks_ranges) Utils.exit_with_msg("Arquivo \"ranges.json\" não encontrado!");

  await Stonks.download_historicals(stocks_ranges);
}

/******************************************************************************/
// 5. Calcula a evolução da carteira de investimentos ao longo do tempo.
// tickers, positions => portfolio
run_portfolio = () => {
  let tickers = Storage.load_tickers();
  if (!tickers) Utils.exit_with_msg("Arquivo \"tickers.json\" não encontrado!");

  let positions = Storage.load_positions();
  if (!positions) Utils.exit_with_msg("Arquivo \"positions.json\" não encontrado!");

  let portfolio = Stonks.calculate_portfolio(positions);

  Storage.save_portfolio(portfolio, tickers);
}

/******************************************************************************/
// 6. Exibe o status (diário, mensal, anual e  total)  dos  rendimentos  e  das
// rentabilidades nominais da carteira de investimentos.
// positions, portfolio => show_status()
run_status = () => {
  let positions = Storage.load_positions();
  if (!positions) Utils.exit_with_msg("Arquivo \"positions.json\" não encontrado!");

  let portfolio = Storage.load_portfolio();
  if (!portfolio) Utils.exit_with_msg("Arquivo \"portfolio.json\" não encontrado!");

  Stonks.show_status(positions, portfolio);
}

/******************************************************************************/
// 0. Executa todos os passos do programa STONKS.
// pdfs, Storage|Web =>
// companies, stocks, trades, taxes, tickers,
// positions, historicals, portfolio, show_status()
run_stonks = async () => {
  // stocks
  let [companies, stocks] = await run_stocks();

  // notes
  let [trades, taxes] = await Notes.parse_folder(Config.NOTES_FOLDER, Config.PASSWORDS);
  let tickers = Stonks.add_tickers(trades, stocks);

  // positions
  let positions = Stonks.calculate_positions(trades);
  let stocks_ranges = Stonks.get_stocks_ranges(positions);

  // prices
  await Stonks.download_historicals(stocks_ranges);

  // portfolio
  let portfolio = Stonks.calculate_portfolio(positions);

  // status
  Stonks.show_status(positions, portfolio);

  // Salva tudo
  Storage.save_trades(trades);
  Storage.save_taxes(taxes);
  Storage.save_tickers(tickers);
  Storage.save_positions(positions, tickers);
  Storage.save_ranges(stocks_ranges);
  Storage.save_portfolio(portfolio, tickers);
}

/******************************************************************************/
// Função principal.
(main = () => {
  let step = process.argv[2];
  switch (step) {
    case "stocks":    run_stocks();    break;
    case "notes":     run_notes();     break;
    case "positions": run_positions(); break;
    case "prices":    run_prices();    break;
    case "portfolio": run_portfolio(); break;
    case "status":    run_status();    break;
    default:          run_stonks();
  }
})();

/******************************************************************************/
