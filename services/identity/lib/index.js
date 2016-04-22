'use strict';

const _ = require('lodash');
const uuid = require('uuid');

exports.composeConfig = function (identity) {
	const channelFeatures = _.keys(identity.channel.features);
	const platformFeatures = _.keys(identity.platform.features);
	const features = _.union(channelFeatures, platformFeatures);

	const confg = {
		features: {},
		views: identity.platform.views
	};

	_.each(features, key => {
		const channelKey = identity.channel.features[key];
		const platformKey = identity.platform.features[key];
		const mergedKey = _.merge({}, channelKey, platformKey);

		confg.features[key] = mergedKey;
	});

	return confg;
};

exports.generateLinkCode = function () {
	return uuid.v4().substring(0, 5).toUpperCase();
};

exports.generatePlatformCode = function () {
	return uuid.v4();
};

exports.linkCodeKey = function (channel, platform, linkCode) {
	return `identity:auth:link_code:${channel}:${platform}:${linkCode.toUpperCase()}`;
};

exports.platformCodeKey = function (channel, platform, platformCode) {
	return `identity:auth:platform_code:${channel}:${platform}:${platformCode}`;
};
