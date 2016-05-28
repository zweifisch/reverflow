"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var oneAfterOne = function oneAfterOne(fns) {
    return fns.reduce(function (last, fn) {
        return last.then(fn);
    }, Promise.resolve());
};

var execTask = function execTask(task, input, rollback) {
    return(
        /* well behaived tasks accept two arguments while normals function accept zero or one */
        task.length === 2 ? task(input, true) : Promise.resolve(input).then(task).then(function (result) {
            return [result, null];
        })
    );
};

var execSerial = function execSerial(tasks, input) {
    return tasks.reduce(function (promise, task) {
        return promise.then(function (_ref) {
            var _ref2 = _slicedToArray(_ref, 2);

            var result = _ref2[0];
            var rollbacks = _ref2[1];
            return execTask(task, result).then(function (_ref3) {
                var _ref4 = _slicedToArray(_ref3, 2);

                var result = _ref4[0];
                var rollback = _ref4[1];
                return [result, rollback ? [rollback].concat(rollbacks) : rollbacks];
            }, function (err) {
                return Promise.reject([err, rollbacks]);
            });
        });
    }, Promise.resolve([input, []])).then(function (_ref5) {
        var _ref6 = _slicedToArray(_ref5, 2);

        var result = _ref6[0];
        var rollbacks = _ref6[1];
        return [result, rollbacks.length && function () {
            return oneAfterOne(rollbacks);
        }];
    }, function (_ref7) {
        var _ref8 = _slicedToArray(_ref7, 2);

        var err = _ref8[0];
        var rollbacks = _ref8[1];
        return oneAfterOne(rollbacks).then(function () {
            return Promise.reject(err);
        });
    });
};

exports.serial = function () {
    for (var _len = arguments.length, tasks = Array(_len), _key = 0; _key < _len; _key++) {
        tasks[_key] = arguments[_key];
    }

    return function (input, internalcall) {
        return execSerial(tasks, input).then(function (result) {
            return internalcall ? result : result[0];
        });
    };
};

var execConcurrent = function execConcurrent(tasks, input) {
    return Promise.all(tasks.map(function (task) {
        return execTask(task, input).catch(function (err) {
            return [null, null, err];
        });
    })).then(function (results) {
        return [results.map(function (_ref9) {
            var _ref10 = _slicedToArray(_ref9, 1);

            var result = _ref10[0];
            return result;
        }), function () {
            return Promise.all(results.filter(function (_ref11) {
                var _ref12 = _slicedToArray(_ref11, 2);

                var _result = _ref12[0];
                var rollback = _ref12[1];
                return rollback;
            }).map(function (_ref13) {
                var _ref14 = _slicedToArray(_ref13, 2);

                var _result = _ref14[0];
                var rollback = _ref14[1];
                return rollback();
            }));
        }, results.find(function (_ref15) {
            var _ref16 = _slicedToArray(_ref15, 3);

            var _result = _ref16[0];
            var _rollback = _ref16[1];
            var err = _ref16[2];
            return err;
        })];
    }).then(function (_ref17) {
        var _ref18 = _slicedToArray(_ref17, 3);

        var result = _ref18[0];
        var rollback = _ref18[1];
        var err = _ref18[2];
        return err ? rollback().then(function () {
            return Promise.reject(err);
        }) : [result, rollback];
    });
};

exports.concurrent = function () {
    for (var _len2 = arguments.length, tasks = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        tasks[_key2] = arguments[_key2];
    }

    return function (input, internalcall) {
        return execConcurrent(tasks, input).then(function (result) {
            return internalcall ? result : result[0];
        });
    };
};

var execRollbackable = function execRollbackable(task, rollback, input) {
    return execTask(task, input).then(function (_ref19) {
        var _ref20 = _slicedToArray(_ref19, 2);

        var result = _ref20[0];
        var _rollback = _ref20[1];
        return [result, function () {
            return Promise.resolve(result).then(rollback).then(_rollback);
        }];
    });
};

exports.rollbackable = function (task, rollback) {
    return function (input, internalcall) {
        return execRollbackable(task, rollback, input).then(function (result) {
            return internalcall ? result : result[0];
        });
    };
};
