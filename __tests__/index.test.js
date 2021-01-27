const { parseCsv } = require('./helper');
const { constants, SalaryPaycheck } = require('../index');

const checkCalculation = async (year, startFrom, interval, callback) => {
  const yearly = startFrom === 'Year';
  const csv = await parseCsv(`__tests__/tax-${year}-${yearly ? 'yearly' : 'monthly'}.csv`);
  const MAXIMUM_DISCREPANCY = 0.6;

  for (let i = 3; i < csv.length; i += interval) {
    const data = csv[i];
    const salaryInput = {
      income: data.income,
      allowance: yearly,
      socialSecurity: true,
      older: false,
      hours: 40,
    };
    [
      salaryInput, // Before retirement age
      { // After retirement age
        ...salaryInput,
        older: true,
      }
    ].forEach((input) => {
      const paycheck = new SalaryPaycheck(input, startFrom, year, {
        checked: false,
      });
      const age = input.older ? 'older' : 'younger';
      data.taxWithoutCredit = data[`${age}WithoutPayrollTaxCredit`];
      data.incomeTax = data[`${age}WithPayrollTaxCredit`];
      data.labourCredit = null;
      data.generalCredit = null;
      data.taxCredit = data.taxWithoutCredit - data.incomeTax;
      if (yearly) { // Tax Authority gives yearly data in percentage
        data.taxWithoutCredit = data.income / data[`${age}WithoutPayrollTaxCredit`];
        // data[`${age}WithPayrollTaxCredit`] *= data.income; //(data[`${age}WithPayrollTaxCredit`] - data[`${age}DeductedLabourCredit`]) * data.income;
        // data.labourCredit = data[`${age}DeductedLabourCredit`] * data.income;
        data.incomeTax = data.income / (data[`${age}WithPayrollTaxCredit`] + data[`${age}DeductedLabourCredit`]);
        data.taxCredit = data.taxWithoutCredit - data.incomeTax;
      }
      // if (data[`${age}DeductedLabourCredit`] != null) {
      //   data.generalCredit = Math.abs(data.taxCredit - data[`${age}DeductedLabourCredit`]);
      // }
      data.netIncome = data.income - data.incomeTax;
      try {
        expect(paycheck[`gross${startFrom}`]).toBeAround(data.income, MAXIMUM_DISCREPANCY);
        expect(Math.abs(paycheck[`taxWithoutCredit${yearly ? '' : 'Month'}`])).toBeAround(data.taxWithoutCredit, MAXIMUM_DISCREPANCY);
        expect(paycheck[`taxCredit${yearly ? '' : 'Month'}`]).toBeAround(data.taxCredit, MAXIMUM_DISCREPANCY);
        if (data.labourCredit) {
          expect(paycheck[`labourCredit${yearly ? '' : 'Month'}`]).toBeAround(data.labourCredit, MAXIMUM_DISCREPANCY);
        }
        if (data.generalCredit) {
          expect(paycheck[`generalCredit${yearly ? '' : 'Month'}`]).toBeAround(data.generalCredit, MAXIMUM_DISCREPANCY);
        }
        expect(Math.abs(paycheck[`incomeTax${yearly ? '' : 'Month'}`])).toBeAround(data.incomeTax, MAXIMUM_DISCREPANCY);
        expect(paycheck[`net${startFrom}`]).toBeAround(data.netIncome, MAXIMUM_DISCREPANCY);
      } catch (err) {
        console.debug({ year, row: data, paycheck: paycheck });
        throw err;
      }
    });
    
    // // After retirement age
    // const paycheckOlder = new SalaryPaycheck({
    //   income: data.income,
    //   allowance: false,
    //   socialSecurity: true,
    //   older: true,
    //   hours: 40,
    // }, startFrom, year, {
    //   checked: false,
    // });
    // data.taxCredit = data.olderWithoutPayrollTaxCredit - data.olderWithPayrollTaxCredit;
    // data.generalCredit = Math.abs(data.taxCredit - data.youngerDeductedLabourCredit);
    // data.netIncome = data.income - data.olderWithPayrollTaxCredit;
    // try {
    //   expect(paycheckOlder[`gross${startFrom}`]).toBeAround(data.income, MAXIMUM_DISCREPANCY);
    //   expect(Math.abs(paycheckOlder[`taxWithoutCredit${startFrom}`])).toBeAround(data.olderWithoutPayrollTaxCredit, MAXIMUM_DISCREPANCY);
    //   expect(paycheckOlder[`taxCredit${startFrom}`]).toBeAround(data.taxCredit, MAXIMUM_DISCREPANCY);
    //   // expect(paycheckOlder[`labourCredit${startFrom}`]).toBeAround(data.olderDeductedLabourCredit, MAXIMUM_DISCREPANCY);
    //   // expect(paycheckOlder[`generalCredit${startFrom}`]).toBeAround(data.generalCredit, MAXIMUM_DISCREPANCY);
    //   expect(Math.abs(paycheckOlder[`incomeTax${startFrom}`])).toBeAround(data.olderWithPayrollTaxCredit, MAXIMUM_DISCREPANCY);
    //   expect(paycheckOlder[`net${startFrom}`]).toBeAround(data.netIncome, MAXIMUM_DISCREPANCY);
    // } catch (err) {
    //   // console.debug({ year, row: data, paycheck: paycheckOlder });
    //   throw err;
    // }
  }
  callback();
}

test('check constants JSON data', () => {
  expect(constants).toHaveProperty('currentYear');
  expect(constants).toHaveProperty('years');
  expect(constants).toHaveProperty('rulingThreshold');
  expect(constants).toHaveProperty('payrollTax');
  expect(constants).toHaveProperty('socialPercent');
  expect(constants).toHaveProperty('generalCredit');
  expect(constants).toHaveProperty('labourCredit');
});

// https://www.belastingdienst.nl/wps/wcm/connect/nl/personeel-en-loon/content/hulpmiddel-loonbelastingtabellen
describe('Tax calculation section', () => {
  // constants.years.forEach((year) => {
  //   test(`calculate monthly tax table for ${year}`, done => {
  //     checkCalculation(year, 'Month', 1, done);
  //   });
  // });

  [2020].forEach((year) => {
    test(`calculate yearly tax table for ${year}`, done => {
      checkCalculation(year, 'Year', 1, done);
    });
  });
});
