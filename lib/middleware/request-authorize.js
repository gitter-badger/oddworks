'use strict';

const _ = require('lodash');
const debug = require('debug')('oddworks:middleware:authorize');
const Boom = require('boom');

module.exports = function (options) {
	options = _.defaults({}, options, {
		audience: Object.create(null)
	});

	if (!options.bus || !_.isObject(options.bus)) {
		throw new Error('The options.bus Object is required.');
	}

	const bus = options.bus;
	const whiteList = options.audience;

	return function authorizeMiddleware(req, res, next) {
		let audience = (req.identity || {}).audience;
		if (!audience) {
			debug('invalid-access-token: Missing token audience claim.');
			bus.broadcast(
				{level: 'warn', event: 'invalid-access-token'},
				{message: 'Missing token audience claim'}
			);
			next(Boom.unauthorized('Missing Token audience claim'));
		}

		audience = Array.isArray(audience) ? audience : [audience];

		const method = req.method.toLowerCase();
		const allowed = whiteList[method];
		debug('method: %s', method);
		debug('audience: %s', audience.join());
		debug('allowed: %s', allowed ? allowed.join() : null);
		if (!allowed) {
			return next(Boom.methodNotAllowed());
		}

		let i;
		for (i = 0; i < allowed.length; i += 1) {
			if (audience.indexOf(allowed[i]) >= 0) {
				return next();
			}
		}

		next(Boom.methodNotAllowed(
			`${req.method} access not permitted to this resource`
		));
	};
};
