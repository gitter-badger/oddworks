'use strict';

const _ = require('lodash');
const Promise = require('bluebird');
const router = require('express').Router(); // eslint-disable-line
const boom = require('boom');
const jwt = require('jsonwebtoken');
Promise.promisifyAll(jwt);

const lib = require('./lib');

const service = exports = module.exports = {};

service.initialize = (bus, options) => {
	service.bus = bus;
	service.options = options || {};

	service.bus.queryHandler({role: 'identity', cmd: 'verify'}, payload => {
		return new Promise((resolve, reject) => {
			jwt
				.verifyAsync(payload.token, service.options.jwtSecret)
				.then(token => {
					Promise
						.join(
							service.bus.query({role: 'store', cmd: 'get', type: 'channel'}, {id: token.channel, type: 'channel'}),
							service.bus.query({role: 'store', cmd: 'get', type: 'platform'}, {id: token.platform, type: 'platform'}),
							(channel, platform) => {
								if (!channel.length && !platform.length) {
									resolve({channel, platform});
								} else {
									reject(new Error('channel or platform not found'));
								}
							}
						);
				})
				.catch(err => reject(err));
		});
	});

	service.bus.queryHandler({role: 'identity', cmd: 'authenticate'}, payload => {
		return new Promise((resolve, reject) => {
			jwt
				.verifyAsync(payload.token, service.options.jwtSecret)
				.then(token => {
					const id = `${token.channel}:${token.platform}:${token.user}`;
					return service.bus.query({role: 'store', cmd: 'get', type: 'linked-platform'}, {id: id, type: 'linked-platform'});
				})
				.then(linkedplatform => resolve(linkedplatform))
				.catch(err => reject(err));
		});
	});

	service.bus.queryHandler({role: 'identity', cmd: 'user'}, payload => {
		return new Promise(resolve => {
			// Get the user from the whatever user management system, local or 3rd party depending on service config
			resolve(payload);
		});
	});

	service.bus.queryHandler({role: 'identity', cmd: 'platform-link'}, payload => {
		return new Promise((resolve, reject) => {
			if (!payload.channel || !payload.platform) {
				return reject(new Error('channel and/or platform required to create platform codes'));
			}

			const linkCode = lib.generateLinkCode();
			const platformCode = lib.generatePlatformCode();

			const platformLink = {
				id: lib.platformCodeKey(payload.channel, payload.platform, linkCode),
				type: 'platform-link',
				linkCode: linkCode,
				platformCode: platformCode
			};

			service.bus.query({role: 'store', cmd: 'set', type: 'platform-link'}, platformLink);

			resolve(platformLink);
		});
	});

	service.bus.queryHandler({role: 'identity', cmd: 'config'}, payload => {
		return new Promise((resolve, reject) => {
			Promise
				.join(
					service.bus.query({role: 'store', cmd: 'get', type: 'channel'}, {id: payload.channel, type: 'channel'}),
					service.bus.query({role: 'store', cmd: 'get', type: 'platform'}, {id: payload.platform, type: 'platform'}),
					(channel, platform) => {
						if (!channel.length && !platform.length) {
							resolve(lib.composeConfig({channel, platform}));
						} else {
							reject(new Error('channel or platform not found'));
						}
					}
				)
				.catch(err => reject(err));
		});
	});

	return Promise.resolve(true);
};

service.middleware = {
	verifyAccess(options) {
		return (req, res, next) => {
			const token = req.get(options.header || 'x-access-token');
			if (token) {
				service.bus
					.query({role: 'identity', cmd: 'verify'}, {token})
					.then(identity => {
						req.identity = identity;
						next();
					})
					.catch(() => next(boom.unauthorized('Invalid Access Token')));
			} else {
				next(boom.unauthorized('Invalid Access Token'));
			}
		};
	},

	authenticateUser(options) {
		return (req, res, next) => {
			const token = req.get(options.header);
			if (token) {
				service.bus
					.query({role: 'identity', cmd: 'authenticate'}, {token})
					.then(identity => {
						req.identity = identity;
						next();
					})
					.catch(() => next(boom.unauthorized('Invalid Authentication Token')));
			} else {
				next(boom.unauthorized('Invalid Authentication Token'));
			}
		};
	}
};

service.router = options => { // eslint-disable-line
	router.get(`/config`, (req, res, next) => {
		service.bus
			.query({role: 'identity', cmd: 'config'}, {channel: req.identity.channel.id, platform: req.identity.platform.id})
			.then(config => {
				res.body = {
					features: config.features,
					views: config.views
				};

				next();
			})
			.catch(err => next(boom.wrap(err)));
	});

	router.get('/platform/code', (req, res, next) => {
		let identityConfig;

		service.bus
			.query({role: 'identity', cmd: 'config'}, {channel: req.identity.channel.id, platform: req.identity.platform.id})
			.then(config => {
				if (!_.get(config, 'features.authentication.enabled', false)) {
					return next(boom.notFound('Authentication is not enabled for this channel and platform'));
				}

				identityConfig = config;

				return service.bus.query({role: 'identity', cmd: 'platform-link'}, {channel: req.identity.channel.id, platform: req.identity.platform.id});
			})
			.then(platformLink => {
				res.body = {
					linkCode: platformLink.linkCode,
					platformCode: platformLink.platformCode,
					verificationUrl: identityConfig.features.authentication.url,
					expiresIn: identityConfig.features.authentication.expiresIn,
					requestInterval: identityConfig.features.authentication.requestInterval
				};

				next();
			});
	});

	router.post('/platform/token', (req, res, next) => {
		next();
	});

	router.post('/user/authorize', (req, res, next) => {
		next();
	});

	return router;
};
