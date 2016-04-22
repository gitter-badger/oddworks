'use strict';

const lruCache = require('lru-cache');
const Promise = require('bluebird');
const uuid = require('uuid');

const store = exports = module.exports = {};
let config = {};

store.initialize = (bus, options) => {
	config.bus = bus;
	config.options = options;

	config.cache = lruCache({maxAge: 60 * 1000});

	return new Promise((resolve, reject) => {
		if (options.types) {
			options.types.forEach(type => {
				bus.queryHandler({role: 'store', cmd: 'get', type: type}, get);
				bus.queryHandler({role: 'store', cmd: 'set', type: type}, set);
				bus.commandHandler({role: 'store', cmd: 'set', type: type}, set);
			});

			resolve(true);
		} else {
			reject(new Error('options.types is missing'));
		}
	});
};

function get(payload) {
	return new Promise((resolve, reject) => {
		if (!payload.type) {
			return reject(new Error('payload.type is require'));
		}

		if (!payload.id) {
			return reject(new Error('payload.id is require'));
		}

		return resolve(config.cache.get(`${payload.type}:${payload.id}`));
	});
}

function set(payload) {
	return new Promise(resolve => {
		payload.id = payload.id || uuid.v4();
		config.cache.set(`${payload.type}:${payload.id}`, payload);
		return resolve(payload);
	});
}
