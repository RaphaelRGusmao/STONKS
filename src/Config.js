/******************************************************************************/
/*                                   STONKS                                   */
/*                             Raphael R. Gusmão                              */
/*                                                                            */
/*                                   Config                                   */
/******************************************************************************/

/******************************************************************************/
/* Config                                                                     */
/******************************************************************************/
module.exports = class Config {
  // Pasta com as Notas de Negociação/Corretagem.
  static NOTES_FOLDER = "/pasta_com_as_notas/";

  // Senhas para abrir as Notas de Negociação/Corretagem.
  static PASSWORDS = ["senha1", "senha2"];

  // Página com a lista de todas as empresas brasileiras listadas  na  Bolsa  de
  // Valores.
  static COMPANIES_URL = "http://bvmf.bmfbovespa.com.br/cias-listadas/empresas-listadas/BuscaEmpresaListada.aspx";

  // Página com a lista de todas as empresas estrangeiras (Brazilian  Depositary
  // Receipts (BDR)) listadas na Bolsa de Valores.
  static BDRS_URL = "http://bvmf.bmfbovespa.com.br/cias-listadas/Mercado-Internacional/Mercado-Internacional.aspx";

  // Página com informações de uma empresa.
  // Parâmetro: cvm_code
  static COMPANY_URL = "http://bvmf.bmfbovespa.com.br/pt-br/mercados/acoes/empresas/ExecutaAcaoConsultaInfoEmp.asp?CodCVM=";

  // Página de histórico de ativo.
  // Parâmetro: ticker
  static HISTORICAL_URL = "https://br.advfn.com/common/search/exchanges/more-historical-data/";

  // Diferença média em dias entre o primeiro e o último  dia  exibidos  em  uma
  // página de histórico.
  static DAYS_PER_PAGE = 80;

  // Tempo (em milissegundos) de espera entre requisições http. Usado  para  não
  // sobrecarregar as páginas.
  static SCRAP_DELAY = 10000; // 10s
}

/******************************************************************************/
