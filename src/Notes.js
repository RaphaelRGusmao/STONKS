/******************************************************************************/
/*                                   STONKS                                   */
/*                             Raphael R. Gusmão                              */
/*                                                                            */
/*                                   Notes                                    */
/******************************************************************************/

const PDFJS = require("pdfjs-dist/es5/build/pdf.js");
const fs = require("fs");
const Utils = require("./Utils");
const Stonks = require("./Stonks");

/******************************************************************************/
/* Notes                                                                      */
/******************************************************************************/
module.exports = class Notes {
  /****************************************************************************/
  // Extrai informações do conteúdo "text" de uma página de um  arquivo  PDF  de
  // Nota de Negociação. As informações são:
  //   - Dia da negociação
  //   - Corretora utilizada
  //   - Todos os trades realizados no dia
  //   - Taxas cobradas no dia
  // Output: [
  //   trades: [
  //     {
  //       "data": Date,
  //       "corretora": string,
  //       "negociacao": string,
  //       "compra_venda": "C"|"V",
  //       "tipo_mercado": string,
  //       "prazo": Date,
  //       "especificacao_do_titulo": string,
  //       "quantidade": int,
  //       "preco": float,
  //       "valor_operacao": float
  //     },
  //     ...
  //   ],
  //   taxes: [
  //     {
  //       "data": Date,
  //       "corretora": string,
  //       "valor_liquido_das_operacoes": float,
  //       "taxa_de_liquidacao": float,
  //       "taxa_de_registro": float,
  //       "total_cblc": float,
  //       "taxa_de_termo_opcoes": float,
  //       "taxa_ana": float,
  //       "emolumentos": float,
  //       "total_bovespa_soma": float,
  //       "taxa_operacional": float,
  //       "execucao": float,
  //       "taxa_de_custodia": float,
  //       "impostos": float,
  //       "irrf_sobre_operacoes": float,
  //       "outros": float,
  //       "total_custos_despesas": float,
  //       "liquido": float,
  //       "taxa_total": float
  //     },
  //     ...
  //   ]
  // ]
  static parse_text = (text) => {
    // Data
    let index = text.findIndex(line => line == "Data pregão");
    let data = text[++index].split("/");
    data = new Date(+data[2], data[1] - 1, +data[0]);

    // Corretora
    let corretora = text[++index];

    // Trades
    let trades = [];
    index = text.findIndex(line => line == "D/C");
    while (text[++index] !== "NOTA DE NEGOCIAÇÃO") {
      let trade = {
        data: data,
        corretora: corretora,
        negociacao: "",
        compra_venda: "",
        tipo_mercado: "",
        prazo: "",
        especificacao_do_titulo: "",
        ticker: "",
        quantidade: "",
        preco: "",
        valor_operacao: ""
      };
      trade["negociacao"] = text[index];
      trade["compra_venda"] = text[++index];
      trade["tipo_mercado"] = text[++index];
      if (trade["tipo_mercado"].includes("OPCAO")) {
        trade["prazo"] = Stonks.get_expiration_date(text[++index]);
      }
      while (isNaN(text[++index])) {
        if (text[index].length > 1 & !text[index].includes("#")) {
          trade["especificacao_do_titulo"] += text[index].replace(/\s\s+/g, " ");
        }
      }
      trade["quantidade"] = parseInt(text[index].replace(/\./g, ""));
      trade["preco"] = parseFloat(text[++index].replace(/\./g, "").replace(/,/g, "."));
      trade["valor_operacao"] = parseFloat(text[++index].replace(/\./g, "").replace(/,/g, "."));
      index++;
      trades.push(trade);
    }

    // Taxas
    let taxes = {
      // Clearing
      valor_liquido_das_operacoes: "Valor líquido das operações",
      taxa_de_liquidacao: "Taxa de liquidação",
      taxa_de_registro: "Taxa de Registro",
      total_cblc: "Total CBLC",
      // Bolsa
      taxa_de_termo_opcoes: "Taxa de termo/opções",
      taxa_ana: "Taxa A.N.A.",
      emolumentos: "Emolumentos",
      total_bovespa_soma: "Total Bovespa / Soma",
      // Custos Operacionais
      taxa_operacional: "Taxa Operacional",
      execucao: "Execução",
      taxa_de_custodia: "Taxa de Custódia",
      impostos: "Impostos",
      irrf_sobre_operacoes: "I.R.R.F. s/ operações",
      outros: "Outros",
      total_custos_despesas: "Total Custos / Despesas",
      // Líquido
      liquido: "Líquido"
    };
    for (let key in taxes) {
      index = text.findIndex(line => line.includes(taxes[key]));
      let value = parseFloat(text[index - 1].replace(/\./g, "").replace(/,/g, "."));
      if (index >= 0 && !isNaN(value)) taxes[key] = value;
    }
    let taxa_total = parseFloat((taxes["taxa_de_liquidacao"]
                   + taxes["taxa_de_registro"]
                   + taxes["total_bovespa_soma"]
                   + taxes["total_custos_despesas"]).toFixed(2));
    if (!isNaN(taxa_total)) taxes["taxa_total"] = taxa_total;
    taxes = Object.assign({data: data, corretora: corretora}, taxes);

    return [trades, taxes];
  }

  /****************************************************************************/
  // Extrai as informações  do  arquivo  PDF  de  Nota  de  Negociação  de  nome
  // "filename". Caso o arquivo necessite de senha para ser aberto, alguma senha
  // do array "passwords" deve ser a  correta,  caso  contrário  o  programa  se
  // encerra.
  // Output: [
  //   trades: [ { ... }, ... ],
  //   taxes: [ { ... }, ... ]
  // ]
  static parse_pdf = async (filename, passwords) => {
    let pdf = null;
    for (let j = 0; j < passwords.length; j++) {
      try {
        pdf = await PDFJS.getDocument({url:filename, password:passwords[j]}).promise;
        break;
      } catch (e) {}
    }
    if (!pdf) Utils.exit_with_msg("  Não foi possível abrir o arquivo! Tente uma senha diferente.");

    let numPages = pdf.numPages;

    let trades = [];
    let taxes = [];

    for (let i = 1; i <= numPages; i++) {
      let page = await pdf.getPage(i);
      let content = await page.getTextContent();
      let text = content.items.map(item => item.str);
      let [page_trades, page_taxes] = this.parse_text(text);
      trades.push(...page_trades);
      taxes.push(page_taxes);
    }

    return [trades, taxes];
  }

  /****************************************************************************/
  // Extrai as informações de cada arquivo PDF de Nota de Negociação presente na
  // pasta "folder". Tambám é passado como parâmetro um  array  de  senhas  para
  // abrir os arquivos que necessitem de senha.
  // Output: [
  //   trades: [ { ... }, ... ],
  //   taxes: [ { ... }, ... ]
  // ]
  static parse_folder = async (folder, passwords) => {
    let files = fs.readdirSync(folder);
    files = files.filter(filename => filename.split(".").pop() == "pdf");
    files = files.map(filename => folder + filename);

    let trades = [];
    let taxes = [];

    for (let i in files) {
      console.log("(" + parseFloat(100*i/files.length).toFixed(2) + " %) Lendo arquivo: \"" + files[i] + "\"");
      let [pdf_trades, pdf_taxes] = await this.parse_pdf(files[i], passwords);
      trades.push(...pdf_trades);
      taxes.push(...pdf_taxes);
    }
    console.log("(100 %) Pronto!\n");

    trades.sort((a, b) => a["data"] - b["data"]);
    taxes.sort((a, b) => a["data"] - b["data"]);

    return [trades, taxes];
  }
}

/******************************************************************************/
