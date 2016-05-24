# robusto

building robust application with javascript

## usage

### serial and concurrent

```javascript
import {exec, serial, concurrent} from robusto

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

exec(serial([concurrent([createUser, createProject]), addUserToProject]);
```

### rollbackable operation

```javascript
import {exec, rollbackable, serial, concurrent} from robusto

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

exec(serial([concurrent([createUser, createProject]), addUserToProject])).catch((err)=> console.log(err.message));
```

outputs

```
creating user
creating project
deleting project 102
deleting user 1024
Can't add user to project
```

## nodejs before v6

```javascript
require("robusto/legacy");
```
