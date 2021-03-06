'use strict';

module.exports = function () {
	return function requestOptions(req, res, next) {
		if (req.method === 'OPTIONS') {
			res.send(200);
			req.connection.destroy();
		} else {
			next();
		}
	};
};
