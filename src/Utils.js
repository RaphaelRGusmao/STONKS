/******************************************************************************/
/*                                   STONKS                                   */
/*                             Raphael R. Gusmão                              */
/*                                                                            */
/*                                   Utils                                    */
/******************************************************************************/

/******************************************************************************/
/* Utils                                                                      */
/******************************************************************************/
module.exports = class Utils {
  static ONE_DAY = 1000 * 60 * 60 * 24;
  static MONTHS = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];

  /****************************************************************************/
  // Date => "dd/mm/yyyy"
  static format_date = (date) => {
    return date.toISOString().substr(0, 10).split("-").reverse().join("/");
  }

  /****************************************************************************/
  // Date => "dd/mm/yy"
  static format_date_short = (date) => {
    let [year, month, day] = date.toISOString().substr(0, 10).split("-");
    return [day, month, year.slice(2, 4)].join("/");
  }

  /****************************************************************************/
  // "dd/mm/yyyy" => "dd/mm/yy"
  static date_long_to_short = (date_long) => {
    return date_long.substring(0,6) + date_long.substring(8)
  }

  /****************************************************************************/
  // "dd MONTH yyyy" => Date
  static parse_date_text = (text) => {
    let [day, month, year] = text.split(" ");
    return new Date(year, this.MONTHS.indexOf(month), day);
  }

  /****************************************************************************/
  // "dd/mm/yyyy" => Date
  static parse_date = (text) => {
    let [day, month, year] = text.split("/");
    return new Date(year, month-1, day);
  }

  /****************************************************************************/
  // Retorna a diferença em dias entre as datas "date1" e "date2".
  // Output: int
  static diff_days = (date1, date2) => {
    return Math.ceil((date2 - date1) / this.ONE_DAY);
  }

  /****************************************************************************/
  // Retorna o dia de hoje com o horário zerado.
  // Output: Date
  static today = () => {
    let today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  /****************************************************************************/
  // float => R$...
  static format_money = (value) => {
    if (isNaN(value)) return "R$ ?";
    return value.toLocaleString("pt-BR", {
       minimumFractionDigits: 2,
       style: "currency",
       currency: "BRL"
    });
  }

  /****************************************************************************/
  // Função de delay.
  static sleep = (milliseconds) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /****************************************************************************/
  // Exibe uma mensagem de erro e encerra o programa imediatamente.
  static exit_with_msg = (msg) => {
    console.error(msg);
    process.exit(1);
  }
}

/******************************************************************************/
