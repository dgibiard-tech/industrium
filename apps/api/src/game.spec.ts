import { describe, expect, it } from 'vitest';
import { assertPurchase } from './game';
describe('achat',()=>{
  it('calcule le montant en centimes sans flottants',()=>expect(assertPurchase(3,5,1000n,125n)).toBe(375n));
  it('refuse un stock insuffisant',()=>expect(()=>assertPurchase(2,1,1000n,100n)).toThrow('Stock insuffisant'));
  it('refuse un solde insuffisant',()=>expect(()=>assertPurchase(2,2,199n,100n)).toThrow('Trésorerie insuffisante'));
});
