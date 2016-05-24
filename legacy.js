"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.serial = function (ops) {
    return ["serial", ops];
};

exports.concurrent = function (ops) {
    return ["concurrent", ops];
};

exports.rollbackable = function (op, rollback) {
    return ["rollbackable", [op, rollback]];
};

function execSerialTask(ops, input, rollback) {
    var promise = Promise.resolve([input, rollback]);
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        var _loop = function _loop() {
            var op = _step.value;

            promise = promise.then(function (_ref) {
                var _ref2 = _slicedToArray(_ref, 2);

                var result = _ref2[0];
                var rback = _ref2[1];
                return exec(op, result, rback);
            });
        };

        for (var _iterator = ops[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            _loop();
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    return promise;
}

function execConcurrentTask(ops, input, rollback) {
    var errors = [];
    return Promise.all(ops.map(function (op) {
        return exec(op, input, null).catch(function (err) {
            errors.push(err);
            return [null, null];
        });
    })).then(function (results) {
        return [results.map(function (_ref3) {
            var _ref4 = _slicedToArray(_ref3, 2);

            var result = _ref4[0];
            var _rback = _ref4[1];
            return result;
        }), results.reduce(function (rollback, _ref5) {
            var _ref6 = _slicedToArray(_ref5, 2);

            var result = _ref6[0];
            var rback = _ref6[1];
            return function () {
                return Promise.resolve(result).then(rback).then(rollback);
            };
        }, rollback)];
    }).then(function (_ref7) {
        var _ref8 = _slicedToArray(_ref7, 2);

        var result = _ref8[0];
        var rback = _ref8[1];

        if (errors.length) {
            return rback().then(function () {
                return Promise.reject(errors[0]);
            });
        } else {
            return [result, rback];
        }
    });
}

function exec(task, input, rollback) {
    if ("function" === typeof task) {
        return Promise.resolve(input).then(task).then(function (result) {
            return [result, rollback];
        }).catch(function (err) {
            return rollback().then(function () {
                return Promise.reject(err);
            });
        });
    }
    if (Array.isArray(task)) {
        var _task = _slicedToArray(task, 3);

        var type = _task[0];
        var ops = _task[1];
        var timeout = _task[2];

        if (type === "rollbackable") {
            var _ret2 = function () {
                var _ops = _slicedToArray(ops, 2);

                var op = _ops[0];
                var rback = _ops[1];

                return {
                    v: exec(op, input, rollback).then(function (_ref9) {
                        var _ref10 = _slicedToArray(_ref9, 2);

                        var result = _ref10[0];
                        var rollback = _ref10[1];
                        return [result, function () {
                            return Promise.resolve(result).then(rback).then(rollback);
                        }];
                    })
                };
            }();

            if ((typeof _ret2 === "undefined" ? "undefined" : _typeof(_ret2)) === "object") return _ret2.v;
        } else if (type === "serial") {
            return execSerialTask(ops, input, rollback);
        } else if (type === "concurrent") {
            return execConcurrentTask(ops, input, rollback);
        } else {
            throw Error("Unexpected task type \"" + type + "\"");
        }
    }
    throw Error("Task should be a function or an array, got " + (typeof task === "undefined" ? "undefined" : _typeof(task)) + ": " + task);
};

exports.exec = function (task, input) {
    return exec(task, input).then(function (_ref11) {
        var _ref12 = _slicedToArray(_ref11, 2);

        var result = _ref12[0];
        var rollback = _ref12[1];
        return result;
    });
};

exports.retry = function retry() {
    var _ref13 = arguments.length <= 0 || arguments[0] === undefined ? { delay: 0, limit: 3, attempts: 1 } : arguments[0];

    var delay = _ref13.delay;
    var limit = _ref13.limit;
    var attempts = _ref13.attempts;
    var task = arguments[1];

    exec(task).catch(function (err) {
        if (attempts >= limit) {
            throw err;
        }
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                retry({ delay: delay,
                    limit: limit,
                    attempts: attempts + 1 }, task).then(resolve, reject);
            }, "function" === typeof delay ? delay(attempts) : delay);
        });
    });
};

exports.exponential = function (base) {
    return function (n) {
        return base * (Math.pow(2, n) - 1) * 0.5;
    };
};

exports.timeout = function (time, _ref14) {
    var _ref15 = _slicedToArray(_ref14, 2);

    var type = _ref15[0];
    var ops = _ref15[1];
    return [type, ops, time];
};
