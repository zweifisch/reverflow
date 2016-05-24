"use strict";

const chai = require("chai");

chai.use(require("chai-as-promised"));
chai.should();

let version = parseInt(process.version.split(".")[0].substr(1));
let lib = version < 6 ? require("./legacy") : require("./index");

let exec = lib.exec;
let serial = lib.serial;
let concurrent = lib.concurrent;
let rollbackable = lib.rollbackable;

describe("serial and concurrent", ()=> {

    let inc = (n)=> n + 1;
    let double = (n)=> n * 2;

    it("should exec in serial", ()=>
       exec(serial([inc, double]), 2).should.become(6));

    it("should exec concurrently", ()=>
       exec(concurrent([inc, double]), 2).should.become([3, 4]));

    it("should mix", ()=>
       exec(concurrent([
           serial([
               inc,
               serial([double, double]),
               inc]),
           double]), 10).should.become([45, 20]));
});

describe("rollback", ()=> {

    let accounts = {foo: 100, bar: 100};

    let transfer = (from, to, amount)=> {
        accounts[from] -= amount;
        accounts[to] += amount;
    };

    it("should not rollback", ()=>
       exec(serial([rollbackable(()=> transfer("foo", "bar", 50),
                                 ()=> transfer("bar", "foo", 50)),
                    ()=> accounts])).should.become({foo: 50, bar: 150}));

    it("should raise", ()=>
       exec(serial([rollbackable(()=> null, ()=> null),
                    ()=> {throw Error("Error");}])).should.berejected);

    it("should rollback", ()=>
       exec(serial([rollbackable(()=> transfer("foo", "bar", 10),
                                 ()=> transfer("bar", "foo", 10)),
                    ()=> {throw Error("Error");}]))
       .catch((err)=> accounts).should.become({foo: 50, bar: 150}));

    let subatomicTransfer = (from, to, amount)=>
        rollbackable(()=> transfer(from, to, amount),
                     ()=> transfer(from, to, -amount));

    it("should rollback multiple steps", ()=>
       exec(serial([subatomicTransfer("foo", "bar", 1),
                    subatomicTransfer("foo", "bar", 2),
                    ()=> null,
                    subatomicTransfer("foo", "bar", 4),
                    subatomicTransfer("foo", "bar", 8),
                    concurrent([()=> accounts, ()=> Promise.reject()])]))
       .catch((err)=> accounts).should.become({foo: 50, bar: 150}));

    it("should rollback concurrent operations", ()=>
       exec(serial([concurrent([subatomicTransfer("foo", "bar", 1),
                                subatomicTransfer("foo", "bar", 2),
                                subatomicTransfer("foo", "bar", 4)]),
                    Promise.reject]))
       .catch((err)=> accounts).should.become({foo: 50, bar: 150}));

    it("should rollback siblings", ()=>
       exec(serial([concurrent([subatomicTransfer("foo", "bar", 1),
                                Promise.reject,
                                subatomicTransfer("foo", "bar", 4)])]))
       .catch((err)=> accounts).should.become({foo: 50, bar: 150}));

    it("should rolllback", ()=>
       exec(serial([subatomicTransfer("foo", "bar", 1),
                    concurrent([subatomicTransfer("foo", "bar", 2),
                                subatomicTransfer("foo", "bar", 4)]),
                    serial([subatomicTransfer("foo", "bar", 8), Promise.reject])]))
       .catch((err)=> accounts).should.become({foo: 50, bar: 150}));

});
