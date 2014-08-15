
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId;

module.exports = function(app) {

	app.get('/push', function(req, res) {
		console.log("Individual PushSettings for a User");

		checkUserAuth(req, res)
			.then(function(user){

				// Fetch the PushSetting for logged-in user
				m.PushSetting.findOne({user_id: user._id}, function(err, PushSetting){
					if(err){
						console.error(err);
						res.status(500);
						res.json(false);
						return;
					}
					if(!PushSetting){
						console.error('Error: No results for PushSetting');
						res.status(500);
						res.json(false);
						return;
					}

					res.json(PushSetting);
				});

			});
			
	});

	app.patch('/push', function(req, res) {
		console.log("Patching PushSettings for User");

		checkUserAuth(req, res)
			.then(function(User){

				// Fetch the PushSetting for logged-in user
				m.PushSetting.findOne({user_id: User._id}, function(err, PushSetting){
					if(err){
						console.error(err);
						res.status(500);
						res.json(false);
						return;
					}
					if(!PushSetting){
						console.error('Error: No results for PushSetting');
						res.status(500);
						res.json(false);
						return;
					}

					var toSave = false;

					var body = req.body;
					console.log('body', req.body);

					try {

						Object.keys(body).forEach(function(key){
							// Only change 'scheme.xyz' values
							var val = body[key];
							var k = key.split('.');
							if(k[0] !== 'scheme'){
								console.log('Invalid scheme key');
								console.log(k);
								return;
							}

							var scheme_key = k[1];

							toSave = true;
							PushSetting.scheme[scheme_key] = val;

						});

						if(!toSave){
							console.log('Nothing to save');
							res.status(400);
							res.json({
								msg: 'nothing to update'
							});
							return;
						}

						PushSetting.save(function(err, newPushSetting){
							if(err){
								console.log('Failed updating newPushSetting');
								res.status(500);
								res.json(false);
								console.log(err);
								return;
							}

							console.log('Updated OK');

							res.json(newPushSetting);
						});

					}catch(err){
						console.error(err);
					}

				});


			});
			
	});



}