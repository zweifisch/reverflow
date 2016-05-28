# reverflow

[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]

reversible flow or building robust application with javascript

## usage

for node < v6 require the transpiled version

```javascript
var reverflow = require("reverflow/legacy");
```

### serial and concurrent

```javascript
import {serial, concurrent} from reverflow

let createUser = function() {
    console.log("creating user");
    return {id: 1024};
};

let createProject = function () {
    console.log("creating project");
    return {id: 102};
};

let addUserToProject = function([user, project]) {
    console.log(`adding user ${user.id} to project ${project.id}`);
};

serial(concurrent(createUser, createProject), addUserToProject)();
```

### rollbackable operation

```javascript
import {rollbackable, serial, concurrent} from reverflow

let createUser = rollbackable(function() {
    console.log("creating user");
    return {id: 1024};
}, function(user) {
    console.log(`deleting user ${user.id}`);
});

let createProject = rollbackable(function () {
    console.log("creating project");
    return {id: 102};
}, function(project) {
    console.log(`deleting project ${project.id}`)
});

let addUserToProject = function([user, project]) {
    throw Error("Can't add user to project");
};

serial(concurrent(createUser, createProject), addUserToProject)().catch(console.log);
```

outputs

```
creating user
creating project
deleting project 102
deleting user 1024
Can't add user to project
```

[npm-image]: https://img.shields.io/npm/v/reverflow.svg?style=flat
[npm-url]: https://npmjs.org/package/reverflow
[travis-image]: https://img.shields.io/travis/zweifisch/reverflow.svg?style=flat
[travis-url]: https://travis-ci.org/zweifisch/reverflow
