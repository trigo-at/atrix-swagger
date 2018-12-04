'use strict';

const Joi = require('joi');

module.exports.config = {
    validate: {
        params: {
            id: Joi.string(),
        },
        query: {
            page: Joi.string(),
        },
        payload: {
            name: Joi.string(),
        },
    },
};

module.exports.handler = (req, reply) =>
    reply({
        payload: req.payload,
    });
