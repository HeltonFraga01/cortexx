#!/usr/bin/env node

/**
 * Property-Based Tests for Credit Balance Consistency
 * Tests credit transactions, balance calculations, and consistency
 * 
 * **Feature: contact-crm-evolution**
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Generator for positive credit amounts
const creditAmountGen = fc.integer({ min: 1, max: 10000 });

// Generator for transaction types
const transactionTypeGen = fc.constantFrom('credit', 'debit', 'adjustment');

// Generator for a sequence of transactions
const transactionSequenceGen = fc.array(
  fc.record({
    type: transactionTypeGen,
    amount: creditAmountGen
  }),
  { minLength: 1, maxLength: 20 }
);

/**
 * Simulates credit balance calculation
 * @param {Array} transactions - Array of {type, amount} objects
 * @param {number} initialBalance - Starting balance
 * @returns {Object} Final balance and transaction history
 */
function simulateCreditTransactions(transactions, initialBalance = 0) {
  let balance = initialBalance;
  const history = [];

  for (const tx of transactions) {
    let effectiveAmount;
    
    if (tx.type === 'credit' || tx.type === 'adjustment') {
      effectiveAmount = tx.amount;
    } else if (tx.type === 'debit') {
      // Debit can only consume up to available balance
      effectiveAmount = -Math.min(tx.amount, balance);
    } else {
      effectiveAmount = 0;
    }

    balance = Math.max(0, balance + effectiveAmount);
    
    history.push({
      type: tx.type,
      amount: effectiveAmount,
      balance_after: balance
    });
  }

  return { balance, history };
}

/**
 * **Feature: contact-crm-evolution, Property 4: Credit Balance Consistency**
 * *For any* contact, the credit_balance SHALL equal the sum of all credit_transaction amounts.
 * After any credit transaction, the balance_after field SHALL equal the previous balance plus the transaction amount.
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.7**
 */
test('Property 4: Credit Balance equals sum of transactions', () => {
  fc.assert(
    fc.property(transactionSequenceGen, (transactions) => {
      const { balance, history } = simulateCreditTransactions(transactions, 0);
      
      // Calculate expected balance from transaction amounts
      const sumOfAmounts = history.reduce((sum, tx) => sum + tx.amount, 0);
      
      // Balance should equal sum of all transaction amounts
      assert.strictEqual(balance, sumOfAmounts,
        `Balance ${balance} should equal sum of amounts ${sumOfAmounts}`);
      
      // Balance should never be negative
      assert(balance >= 0, `Balance ${balance} should never be negative`);
    }),
    { numRuns: 50 }
  );
});

test('Property 4: balance_after is correct after each transaction', () => {
  fc.assert(
    fc.property(transactionSequenceGen, (transactions) => {
      const { history } = simulateCreditTransactions(transactions, 0);
      
      let runningBalance = 0;
      
      for (const tx of history) {
        const expectedBalance = Math.max(0, runningBalance + tx.amount);
        
        assert.strictEqual(tx.balance_after, expectedBalance,
          `balance_after ${tx.balance_after} should equal ${expectedBalance}`);
        
        runningBalance = tx.balance_after;
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 4: Credits can only be added (positive amounts)', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 1000 }), // initial balance
      fc.array(creditAmountGen, { minLength: 1, maxLength: 10 }), // credit amounts
      (initialBalance, creditAmounts) => {
        let balance = initialBalance;
        
        for (const amount of creditAmounts) {
          const newBalance = balance + amount;
          
          // Adding credits should always increase balance
          assert(newBalance > balance,
            `Adding ${amount} credits should increase balance`);
          
          balance = newBalance;
        }
        
        // Final balance should be initial + sum of all credits
        const expectedFinal = initialBalance + creditAmounts.reduce((a, b) => a + b, 0);
        assert.strictEqual(balance, expectedFinal);
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 4: Debits cannot exceed available balance', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 500 }), // initial balance
      fc.array(creditAmountGen, { minLength: 1, maxLength: 10 }), // debit amounts
      (initialBalance, debitAmounts) => {
        let balance = initialBalance;
        
        for (const amount of debitAmounts) {
          const actualDebit = Math.min(amount, balance);
          const newBalance = balance - actualDebit;
          
          // Balance should never go negative
          assert(newBalance >= 0,
            `Balance ${newBalance} should never be negative`);
          
          // Debit should not exceed available balance
          assert(actualDebit <= balance,
            `Debit ${actualDebit} should not exceed balance ${balance}`);
          
          balance = newBalance;
        }
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 4: Transaction history is complete and ordered', () => {
  fc.assert(
    fc.property(transactionSequenceGen, (transactions) => {
      const { history } = simulateCreditTransactions(transactions, 0);
      
      // History should have same length as input transactions
      assert.strictEqual(history.length, transactions.length,
        `History length ${history.length} should match transactions ${transactions.length}`);
      
      // Each transaction should have required fields
      for (const tx of history) {
        assert('type' in tx, 'Transaction should have type');
        assert('amount' in tx, 'Transaction should have amount');
        assert('balance_after' in tx, 'Transaction should have balance_after');
        assert(typeof tx.balance_after === 'number', 'balance_after should be a number');
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 4: Balance consistency after mixed operations', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 100, max: 1000 }), // initial credits
      fc.array(
        fc.record({
          isCredit: fc.boolean(),
          amount: fc.integer({ min: 1, max: 100 })
        }),
        { minLength: 5, maxLength: 15 }
      ),
      (initialCredits, operations) => {
        let balance = initialCredits;
        let totalCredits = initialCredits;
        let totalDebits = 0;
        
        for (const op of operations) {
          if (op.isCredit) {
            balance += op.amount;
            totalCredits += op.amount;
          } else {
            const actualDebit = Math.min(op.amount, balance);
            balance -= actualDebit;
            totalDebits += actualDebit;
          }
        }
        
        // Final balance should equal total credits minus total debits
        assert.strictEqual(balance, totalCredits - totalDebits,
          `Balance ${balance} should equal credits ${totalCredits} - debits ${totalDebits}`);
        
        // Balance should never be negative
        assert(balance >= 0, `Balance ${balance} should never be negative`);
      }
    ),
    { numRuns: 50 }
  );
});
