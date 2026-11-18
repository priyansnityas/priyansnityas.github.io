const test = require('node:test');
const assert = require('node:assert/strict');
const { budgetUsage, listBudgetUsage, crossingBudgets } = require('../src/ai/budgets.js');
const tx = (id, amount, category='Food', type='Daily Expense') => ({id,amount,category,type,date:'2026-11-12'});

test('budget progress states use 80 and 100 percent boundaries', () => {
  const budget={id:'food',category:'Food',amount:1000};
  assert.equal(budgetUsage(budget,[tx('a',799)],'2026-11').state,'under');
  assert.equal(budgetUsage(budget,[tx('a',800)],'2026-11').state,'near');
  assert.equal(budgetUsage(budget,[tx('a',1000)],'2026-11').state,'near');
  assert.equal(budgetUsage(budget,[tx('a',1001)],'2026-11').state,'over');
});

test('overall budget includes all Daily Expense categories, category budget is scoped', () => {
  const transactions=[tx('a',300,'Food'),tx('b',200,'Fuel'),tx('c',900,'Food','Investment')];
  assert.equal(budgetUsage({scope:'overall',amount:1000},transactions,'2026-11').spent,500);
  assert.equal(budgetUsage({category:'Food',amount:1000},transactions,'2026-11').spent,300);
  assert.equal(listBudgetUsage([{scope:'overall',amount:1000}],transactions,'2026-11')[0].remaining,500);
});

test('warns only when a new Daily Expense crosses from at-or-under to over budget', () => {
  const budgets=[{id:'food',category:'Food',amount:1000},{id:'overall',scope:'overall',amount:2000}];
  assert.equal(crossingBudgets(budgets,[tx('a',900)],tx('b',200),'2026-11').length,1);
  assert.equal(crossingBudgets(budgets,[tx('a',1100)],tx('b',200),'2026-11').length,0);
  assert.equal(crossingBudgets(budgets,[tx('a',900)],tx('b',200,'Food','Investment'),'2026-11').length,0);
  assert.equal(crossingBudgets([{id:'overall',scope:'overall',amount:1000}],[tx('a',900)],tx('b',200,'Fuel'),'2026-11')[0].id,'overall');
});
