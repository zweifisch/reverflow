"use strict";

const chai = require("chai");

chai.use(require("chai-as-promised"));
chai.should();

let version = parseInt(process.version.split(".")[0].substr(1));
let lib = version < 6 ? require("./legacy") : require("./index");

let serial = lib.serial;
let concurrent = lib.concurrent;
let rollbackable = lib.rollbackable;


describe("serial and concurrent", () => {

    let inc = n => n + 1;
    let double = n => n * 2;

    it("should run in serial", () =>
       serial(inc, double)(2).should.become(6));

    it("should run concurrently", () =>
       concurrent(inc, double)(2).should.become([3, 4]));

    it("should mix", () =>
       concurrent(serial(inc,
                         serial(double, double),
                         inc),
                  double)(10).should.become([45, 20]));
});

describe("rollback", () => {

    let accounts = {foo: 100, bar: 100};

    let getAccounts = () => accounts;

    let transfer = (from, to, amount)=> {
        accounts[from] -= amount;
        accounts[to] += amount;
        return amount;
    };

    it("should not rollback", () =>
       serial(rollbackable(() => transfer("foo", "bar", 50),
                           () => transfer("bar", "foo", 50)),
              getAccounts)().should.become({foo: 50, bar: 150}));

    it("should raise", () =>
       serial(rollbackable(() => null, () => null),
              () => {throw Error("Error");})().should.berejected);

    it("should rollback", () =>
       serial(rollbackable(() => transfer("foo", "bar", 10),
                           () => transfer("bar", "foo", 10)),
              () => {throw Error("Should Rollback");})()
       .catch(getAccounts).should.become({foo: 50, bar: 150}));

    let subatomicTransfer = (from, to, amount)=>
            rollbackable(() => transfer(from, to, amount),
                         () => transfer(from, to, -amount));

    it("should rollback multiple steps", () =>
       serial(subatomicTransfer("foo", "bar", 1),
              subatomicTransfer("foo", "bar", 2),
              () => null,
              subatomicTransfer("foo", "bar", 4),
              subatomicTransfer("foo", "bar", 8),
              concurrent(() => accounts, Promise.reject))()
       .catch(getAccounts).should.become({foo: 50, bar: 150}));

    it("should rollback concurrent operations", () =>
       serial(concurrent(subatomicTransfer("foo", "bar", 1),
                         subatomicTransfer("foo", "bar", 2),
                         subatomicTransfer("foo", "bar", 4)),
              Promise.reject)()
       .catch(getAccounts).should.become({foo: 50, bar: 150}));

    it("should rollback siblings", () =>
       serial(concurrent(subatomicTransfer("foo", "bar", 1),
                         Promise.reject,
                         subatomicTransfer("foo", "bar", 4)))()
       .catch(getAccounts).should.become({foo: 50, bar: 150}));

    it("should rolllback", () =>
       serial(subatomicTransfer("foo", "bar", 1),
              concurrent(subatomicTransfer("foo", "bar", 2),
                         subatomicTransfer("foo", "bar", 4)),
              serial(subatomicTransfer("foo", "bar", 8), Promise.reject))()
       .catch(getAccounts).should.become({foo: 50, bar: 150}));

    let num = 10;
    it("should rollback in the right order", () =>
       serial(rollbackable(() => num += 1, () => num -= 1),
              rollbackable(() => num *= 2, () => num /= 2),
              rollbackable(() => num += 3, () => num -= 3),
              Promise.reject)().catch(() => num).should.become(10));

});
