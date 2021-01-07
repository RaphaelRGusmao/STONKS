/******************************************************************************/
/*                                   STONKS                                   */
/*                             Raphael R. Gusmão                              */
/*                                                                            */
/*                                  Scraper                                   */
/******************************************************************************/

const puppeteer = require("puppeteer");
const axios = require("axios");
const cheerio = require("cheerio");
const Config = require("./Config");
const Utils = require("./Utils");

/******************************************************************************/
/* Scraper                                                                    */
/******************************************************************************/
module.exports = class Scraper {
  /****************************************************************************/
  // Extrai da internet dados de todas as empresas listadas na bolsa de  valores
  // brasileira.
  // Output: [
  //   {
  //     "nome": string,
  //     "cvm_code": string,
  //     "tickers": [ string, ... ],
  //     "segmento": string
  //   },
  //   ...
  // ]
  static scrape_companies = async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 2000 });
    await page.setDefaultNavigationTimeout(0);

    console.log("Acessando lista de empresas...");
    await page.goto(Config.COMPANIES_URL);
    await page.click("input[value=Todas]");
    await page.waitForTimeout(Config.SCRAP_DELAY);

    // Obtem os dados de todas as empresas
    let companies = await page.evaluate(() => {
      let table = Array.from(document.querySelector("tbody").children);
      return table.map(row => {
        return {
          "nome":     row.getElementsByTagName("A")[1].text,
          "cvm_code": row.getElementsByTagName("A")[1].href.split("=")[1],
          "segmento": row.getElementsByTagName("td")[2].textContent.trim()
        }
      });
    });

    // Obtem todos os tickers existentes de cada empresa
    for (let i in companies) {
      console.log(
        "(" + parseFloat(100*i/companies.length).toFixed(2) + " % - "
        + (+i + 1) + "/" + companies.length + ") "
        + "Obtendo tickers de: " + companies[i]["nome"]
      );
      await page.goto(Config.COMPANY_URL + companies[i]["cvm_code"]);
      let tickers = await page.evaluate(() => {
        let div = document.querySelector("#spnCodigosOculto").parentElement;
        let list = Array.from(div.getElementsByClassName("LinkCodNeg"));
        return [...new Set(list.map(element => element.text))];
      });
      companies[i]["tickers"] = tickers;
    }
    companies = companies.filter(company => company["tickers"].length && !company["tickers"].includes(""));
    console.log("(100 %) Pronto!");

    await browser.close();

    return companies;
  }

  /****************************************************************************/
  // Extrai da internet os dados de  histórico  do  ativo  "ticker"  durante  os
  // períodos contidos no array "ranges".
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
  static scrape_historical = async (ticker, ranges) => {
    let historical = [];

    console.log("Baixando o histórico de:", ticker);
    let response = await axios(Config.HISTORICAL_URL + ticker.split(" ")[0]);
    let real_url = response.request.res.responseUrl;

    for (let range of ranges) {
      let temp_historical = [];

      let earlier_start = new Date(+range["start"] - 7*Utils.ONE_DAY);
      let start = Utils.format_date_short(earlier_start);

      let later_end = new Date(+range["end"] + 7*Utils.ONE_DAY);
      let end = Utils.format_date_short(later_end);

      console.log("  (" +
        Utils.format_date(range["start"]) + " - " +
        Utils.format_date(range["end"] || new Date()) +
      ")");
      for (let i = 0;; i++) {
        console.log("    Página:", i);

        await Utils.sleep(Config.SCRAP_DELAY);
        response = await axios(real_url, {
          params: {
            current: i,
            Date1: start,
            Date2: end
          }
        });
        let $ = cheerio.load(response.data);

        let table = $(".histo-results > tbody > tr").slice(1);
        if (table.find("td").length == 1) break;
        let values = table.map((_, row) => ({
          "data":       Utils.parse_date_text($(row).children().eq(0).text()),
          "fechamento": parseFloat($(row).children().eq(1).text().replace(/\./g, "").replace(/,/g, ".")),
          "variacao":   parseFloat($(row).children().eq(2).text().replace(/\./g, "").replace(/,/g, ".")),
          "variacao_%": parseFloat($(row).children().eq(3).text().replace(/\./g, "").replace(/,/g, ".").slice(0, -1)),
          "abertura":   parseFloat($(row).children().eq(4).text().replace(/\./g, "").replace(/,/g, ".")),
          "maxima":     parseFloat($(row).children().eq(5).text().replace(/\./g, "").replace(/,/g, ".")),
          "minima":     parseFloat($(row).children().eq(6).text().replace(/\./g, "").replace(/,/g, ".")),
          "volume":     parseFloat($(row).children().eq(7).text().replace(/\./g, "").replace(/,/g, "."))
        })).get();
        temp_historical.push(...values);

        if (!$("#next").length) break;
      }

      temp_historical.reverse();
      temp_historical = this.#clean_historical(temp_historical, range);
      historical.push(...temp_historical);
    }

    return historical;
  }

  /****************************************************************************/
  // Método privado. Realiza a limpeza  dos  dados  de  histórico  extraídos  da
  // internet.
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
  static #clean_historical = (historical, range) => {
    let clean = [...historical];

    for (let i = 1; i < clean.length; i++) {
      if (clean[i]["volume"] == 0) {
        clean[i] = Object.assign({}, clean[i], {
          "fechamento": clean[i-1]["fechamento"],
          "variacao":   0,
          "variacao_%": 0,
          "abertura":   clean[i-1]["fechamento"],
          "maxima":     clean[i-1]["fechamento"],
          "minima":     clean[i-1]["fechamento"]
        });
      }

      while (1) {
        let last_row_next_day = +clean[i-1]["data"] + Utils.ONE_DAY;
        if (clean[i]["data"].getTime() == last_row_next_day) break;

        if (clean[i]["data"].getTime() < last_row_next_day) {
          if (i + 1 < clean.length) {
            if (clean[i]["fechamento"] != clean[i-1]["fechamento"]
             && clean[i]["fechamento"] == clean[i+1]["fechamento"]
             && clean[i]["volume"] > 0) {
               clean[i+1] = Object.assign({}, clean[i+1], {
                 "variacao":   clean[i]["variacao"],
                 "variacao_%": clean[i]["variacao_ratio"],
                 "abertura":   clean[i]["abertura"],
                 "maxima":     clean[i]["maxima"],
                 "minima":     clean[i]["minima"],
                 "volume":     clean[i]["volume"]
               });
            }
          }
          clean.splice(i--, 1);
          break;
        }

        let new_row = {
          "data":       new Date(last_row_next_day),
          "fechamento": clean[i-1]["fechamento"],
          "variacao":   0,
          "variacao_%": 0,
          "abertura":   clean[i-1]["fechamento"],
          "maxima":     clean[i-1]["fechamento"],
          "minima":     clean[i-1]["fechamento"],
          "volume":     0
        };
        clean.splice(i++, 0, new_row);
      }
    }

    while (clean[clean.length - 1]["data"].getTime() < range["end"].getTime()) {
      let next_day = +clean[clean.length - 1]["data"] + Utils.ONE_DAY;
      let new_row = {
        "data":       new Date(next_day),
        "fechamento": clean[clean.length - 1]["fechamento"],
        "variacao":   0,
        "variacao_%": 0,
        "abertura":   clean[clean.length - 1]["fechamento"],
        "maxima":     clean[clean.length - 1]["fechamento"],
        "minima":     clean[clean.length - 1]["fechamento"],
        "volume":     0
      };
      clean.push(new_row);
    }

    while (clean[0]["data"].getTime() < range["start"].getTime()) clean.splice(0, 1);

    let i = clean.length - 1;
    while (clean[i]["data"].getTime() > range["end"].getTime()) clean.splice(i--, 1);

    return clean;
  }
}

/******************************************************************************/
