import test from 'node:test';
import assert from 'node:assert/strict';
import {collateralHealth} from '../assets/federation/fed-learn-risk.mjs';
test('collateral shock crosses the boundary without changing the assumed debt', () => {
 assert.equal(collateralHealth(2000,1000,.8,0).factor,1.6);
 assert.equal(collateralHealth(2000,1000,.8,20).state,'above_boundary');
 assert.equal(collateralHealth(2000,1000,.8,37.5).state,'at_boundary');
 assert.equal(collateralHealth(2000,1000,.8,40).state,'below_boundary');
 assert.equal(collateralHealth(2000,1000,.8,100).factor,0);
});
test('invalid or unbounded fictional positions do not produce a misleading result', () => {
 for (const args of [[2000,0,.8,0],[2000,1000,1.1,0],[2000,1000,.8,-1],[2000,1000,.8,101],[Infinity,1000,.8,0],[2000,NaN,.8,0]]) assert.throws(()=>collateralHealth(...args),RangeError);
});
