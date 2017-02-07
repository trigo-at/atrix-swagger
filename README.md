# atrix-swagger

[![Greenkeeper badge](https://badges.greenkeeper.io/trigo-at/atrix-swagger.svg?token=1b8997fdc7747bfa5ed8ec4457e58ea86f97410f1ebe93735217c0b70284c5a3)](https://greenkeeper.io/)
[![NSP Status](https://nodesecurity.io/orgs/trigo-gmbh/projects/33499418-157d-4f55-a5a5-f890212c6897/badge)](https://nodesecurity.io/orgs/trigo-gmbh/projects/33499418-157d-4f55-a5a5-f890212c6897)

## About
atrix-swagger is a atrix microservice plugin to intigrate swagger.io service decription files into the atrix microservice framework

## Features
* Create request & response valisation rules from swagger API spec file
* serve GET /swagger.json to deliver the service's API spec

## Installation

```
# install atrix framework
npm install -S @trigo/atrix

# install atrix-swagger plugin
nom install -S @trigo/atrix-swagger
```

## Usage & Configuration

### service.yml
```yaml
swagger: "2.0"
info:
  description: |
    Example swager API spec (taken from pet store example on swagger.io)
  version: "1.0.0"
  title: Test based on Swagger Pet Store
consumes:
  - application/json
produces:
  - application/json

basePath: /v2
schemes:
  - http

  /pets/{petId}:
    get:
      tags:
        - pet
      summary: Find pet by ID
      description: Returns a pet when ID < 10.  ID > 10 or nonintegers will simulate API error conditions
      produces:
        - application/json
      parameters:
        - in: path
          name: petId
          description: ID of pet that needs to be fetched
          required: true
          type: integer
          format: int64
      responses:
        "404":
          description: Pet not found
        "200":
          description: successful operation
          schema:
            $ref: "#/definitions/Pet"
        "400":
          description: Invalid ID supplied
    post:
      summary: Updates a pet in the store with form data
      description: ""
      operationId: updatePetWithForm
      consumes:
        - application/x-www-form-urlencoded
      produces:
        - application/json
        - application/xml
      parameters:
        - in: path
          name: petId
          description: ID of pet that needs to be updated
          required: true
          type: string
        - in: formData
          name: name
          description: Updated name of the pet
          required: true
          type: string
        - in: formData
          name: status
          description: Updated status of the pet
          required: true
          type: string
      responses:
        "405":
          description: Invalid input
      security:
        - petstore_auth:
          - write_pets
          - read_pets
    delete:
      tags:
        - pet
      summary: Deletes a pet
      description: ""
      operationId: deletePet
      produces:
        - application/json
        - application/xml
      parameters:
        - in: header
          name: api_key
          description: ""
          required: true
          type: string
        - in: path
          name: petId
          description: Pet id to delete
          required: true
          type: integer
          format: int64
      responses:
        "400":
          description: Invalid pet value
      security:
        - petstore_auth:
          - write_pets
          - read_pets
definitions:
  Pet:
    type: object
    required:
      - name
      - photoUrls
    properties:
      id:
        type: integer
        format: int64
      name:
        type: string
        example: doggie
      photoUrls:
        type: array
        items:
          type: string
      status:
        type: string
        description: pet status in the store
```
### handlers/pets/{petId}_GET.js
```javascript
'use strict';

module.exports = (req, reply, service) => {
	// params object is automatically validated acordiing to the swagger spec
	if(req.params.petId) { ... } 
	
	// same applies to req.query, req.payload => validation automaticlly applied
	
	// respoonse will be validated as defined in swager spec
	reply(resulObj)
}
```

### index.js
```javascript
'use strict';

const atrix = require('@trigo/atrix');
const path = require('path');

const svc = new atrix.Service('s1', {
	// declare swagger section
	swagger: {
		// let atrix-swagger know where the service API spec file is located
		serviceDefinition: path.join(__dirname, './service.yml'),
	},
	// commont atrix service config
	endpoints: {
		http: {
			port: 3000,
			handlerDir: `${__dirname}/handler`,
		},
	},
});
atrix.addService(svc);
svc.endpoints.add('http');
svc.start();
```
To get complete parsed Swagger API spec from service as JSON simply use  the /swager.json endpoint
```curl http://localhost:3000/swagger.json```
