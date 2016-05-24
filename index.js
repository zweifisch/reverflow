"use strict";

exports.serial = ops => ["serial", ops];

exports.concurrent = ops => ["concurrent", ops];

exports.rollbackable = (op, rollback) => ["rollbackable", [op, rollback]];

function execSerialTask(ops, input, rollback) {
    let promise = Promise.resolve([input, rollback]);
    for (let op of ops) {
        promise = promise.then(([result, rback]) => exec(op, result, rback));
    }
    return promise;
}

function execConcurrentTask(ops, input, rollback) {
    let errors = [];
    return Promise.all(ops.map(op => exec(op, input, null)
                               .catch((err)=> {
                                   errors.push(err);
                                   return [null, null];
                               })))
        .then((results)=> [results.map(([result, _rback])=> result),
                           results.reduce((rollback, [result, rback]) => () => Promise.resolve(result).then(rback).then(rollback),
                                          rollback)])
        .then(([result, rback]) => {
            if (errors.length) {
                return rback().then(()=> Promise.reject(errors[0]));
            } else {
                return [result, rback];
            }
        });
}

function exec(task, input, rollback) {
    if ("function" === typeof task) {
        return Promise.resolve(input).then(task).then(result => [result, rollback])
            .catch(err => rollback().then(() => Promise.reject(err)));
    }
    if (Array.isArray(task)) {
        let [type, ops, timeout] = task;
        if (type === "rollbackable") {
            let [op, rback] = ops;
            return exec(op, input, rollback)
                .then(([result, rollback]) => [
                    result, () => Promise.resolve(result).then(rback).then(rollback)]);
        } else if (type === "serial") {
            return execSerialTask(ops, input, rollback);
        } else if (type === "concurrent") {
            return execConcurrentTask(ops, input, rollback);
        } else {
            throw Error(`Unexpected task type "${type}"`);
        }
    }
    throw Error(`Task should be a function or an array, got ${typeof task}: ${task}`);
};

exports.exec = function (task, input) {
    return exec(task, input).then(([result, rollback]) => result);
};

exports.retry = function retry({delay, limit, attempts} = {delay: 0, limit: 3, attempts: 1}, task) {
    exec(task).catch(function(err) {
        if (attempts >= limit) {
            throw err;
        }
        return new Promise(function(resolve, reject) {
            setTimeout(function() {
                retry({delay: delay,
                       limit: limit,
                       attempts: attempts + 1}, task).then(resolve, reject);
            }, "function" === typeof delay ? delay(attempts) : delay);
        });
    });
};

exports.exponential = base => n => base * (Math.pow(2, n) - 1) * 0.5;

exports.timeout = (time, [type, ops]) => [type, ops, time]
