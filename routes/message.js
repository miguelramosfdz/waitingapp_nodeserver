
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId;

module.exports = function(app) {
  
	// Public website
	// - API below

	app.get('/message/public/:game_id', function(req, res) {
		console.log("Individual message");

		// Get Message
		var messageId = ObjectID(req.params.message_id);
		m.Message.findOne({ _id: messageId })
		.populate('media')
		.exec(function(err, Message) {
			if(err){
				console.log('Error:');
				console.error(err);
				res.status(500);
				res.send(false);
				return;
			}
			if(!Message){
				console.log('No such public message');
				res.status(500);
				res.send("No such public message");
				return;
			}

			var MessageCopy = Message.toJSON();

			res.render('message/public', {Message: MessageCopy});

		});
			
	});
	
	// API
	app.post('/message', function(req, res) {
		console.log("Creating a new message");

		checkUserAuth(req, res)
			.then(function(user){

				// Find "to" user
				// - via user_id or username

				var conditions = {};
				if(req.body.to_user_id){
					conditions._id = ObjectID(req.body.to_user_id);
				} else if(req.body.to_username) {
					conditions.username_lowercase = req.body.to_username.toString().toLowerCase();
				} else {
					console.error('Missing _id or username of "To" user');
					res.status(404);
					res.json(false);
					return;
				}
				
				m.User.findOne(conditions, function(err, ToUser){
					if (err){
						console.error(err);
						res.status(500);
						res.json(false);
						return;
					}

					if(!ToUser){
						console.error('Messaged user does not exist');
						res.status(404);
						res.json(false);
						return;
					}

					// Media should have been uploaded previously
					var media_id = null;
					if(req.body.media_id){
						media_id = ObjectID(req.body.media_id);
					}

					// Validate that I own this media? 
					// - todo...

					// Text
					var message_text = '';
					if(req.body.text != undefined){
						message_text = req.body.text.toString().trim();
					}
					if(message_text.length < 1 && media_id == null){
						res.status(500);
						res.json({
							msg: 'Empty text and no media'
						});
						return;
					}

					// In-reply-to
					// - todo...

					// Create Message
					var Message = new m.Message({
						
						to_user_id: ToUser._id,
						from_user_id: user._id,
						
						media: media_id,
						text: message_text

					});

					Message.save(
						function(err, newMessage){
							if(err){
								console.error(err);
								res.status(500);
								res.json(false);
								return;
							}

							console.log('Saved message');
							res.json(newMessage);
						});

				});

			});
			
	});

	app.get('/message/:message_id', function(req, res) {
		console.log("Individual message");

		checkUserAuth(req, res)
			.then(function(user){
				var messageId = ObjectID(req.params.message_id);
				var conditions = { 
					_id: messageId, 
					// user_id : user._id 
				};
				m.Message.find(conditions, function(err, items) {
					if(!items || items.length < 1){
						res.json({});
					} else {
						res.json(items[0]);
					}
				});
			});
			
	});

	app.patch('/message/:message_id', function(req, res) {
		console.log("Patching Individual Message");

		checkUserAuth(req, res)
			.then(function(user){
				var messageId = ObjectID(req.params.message_id);
				
				var conditions = {
					_id: messageId,
					user_id: user._id
				};

				// Test the message

				m.Message.findOne(conditions)
				// .populate('car_id')
				.exec(function (err, Message) {
					if (err){
						console.log('alt_models error');
						res.status(500);
						res.json(false);
						return;
					}
					
					var body = req.body;
					if(body.hasOwnProperty('player_id')){
						Message.player_id = body.player_id;
					}
					if(body.hasOwnProperty('riders')){
						Message.riders = body.riders;
					}

					Message.save(function(err, newMessage){
						if(err){
							console.log('Failed updating newMessage');
							res.status(500);
							res.json(false);
							console.log(err);
							return;
						}
						res.json(newMessage);
					});

				});

			});
			
	});

	app.get('/messages', function(req, res) {
		console.log("Finding all messages in db for a user");

		checkUserAuth(req, res)
			.then(function(user){

				// Need to get all the Messages I can possibly access, via Players I'm connected to
				// - technically I can access any Message, right?

				// // Get user's of Player's I've created
				// var created = Q.defer();
				// m.Player.find({ user_id: user._id }, function(err, players){
				// 	created.resolve(players);
				// });

				// // Get user's of Player's who I was connected with
				// var connected = Q.defer();
				// m.Player.find({ connected_user_id: user._id }, function(err, players){
				// 	connected.resolve(players);
				// });

				// Q.all([created.promise, connected.promise])
				// 	.spread(function(createdResults, connectedResults){

				// 		var user_ids = [];
				// 		createdResults.forEach(function(cResult){
				// 			if(cResult.connected_user_id){
				// 				user_ids.push(cResult.connected_user_id);
				// 			}
				// 		});
				// 		connectedResults.forEach(function(cResult){
				// 			user_ids.push(cResult.user_id);
				// 		});

						// Get subset of messages and total results
						// var conditions = {
						// 	user_id : {
						// 			"$in" : user_ids
						// 		}
						// 	};
						var conditions = {
							// active: true
							'$or' : [
								{
									to_user_id: user._id
								},
								{
									from_user_id: user._id
								}
							]
						};
						var fields = '_id __v', // null = all fields
							options = {
								skip: req.query['$skip'] || 0, // skip
								limit: req.query['$top'] || null, // limit
								sort: {_id : -1}
							};
						if(req.query['$filter']){
							conditions = {
								'$and' : [conditions, JSON.parse(req.query['$filter'])]
							};
						}

						var findResult = Q.defer();
						m.Message.find(conditions,fields,options)
						.populate('media')
						.exec(function (err, results) {
							if (err){ // TODO handle err
								console.log('alt_models error');
								return;
							}
							findResult.resolve(results);
						});

						var countResult = Q.defer();
						m.Message.count(conditions, function (err, count) {
							if(err){
								console.log('Err 238947');
							}
							countResult.resolve(count);
						});

						Q.all([findResult.promise, countResult.promise])
							.spread(function(results, totalResults){
								res.json({
									results: results,
									total: totalResults
								});
							});

					// });

			});

	});

	app.get('/messages/users', function(req, res) {
		console.log("Finding users I've communicated with");

		checkUserAuth(req, res)
			.then(function(user){

				// Need to get all the Messages I can possibly access, via Players I'm connected to
				// - technically I can access any Message, right?

				var conditions = {
					// active: true
					'$or' : [
						{
							to_user_id: user._id
						},
						{
							from_user_id: user._id
						}
					]
				};
				var fields = null, // null = all fields
					options = {
						skip: req.query['$skip'] || 0, // skip
						limit: req.query['$top'] || null, // limit
						sort: {_id : -1}
					};
				if(req.query['$filter']){
					conditions = {
						'$and' : [conditions, JSON.parse(req.query['$filter'])]
					};
				}

				m.Message.find(conditions,fields,options)
				// .populate()
				.exec(function (err, messages) {
					if (err){ // TODO handle err
						console.log('alt_models error');
						return;
					}

					// Get user_ids
					var user_ids = [];
					messages.forEach(function(Message){
						user_ids.push(Message.to_user_id.toString());
						user_ids.push(Message.from_user_id.toString());
					});

					user_ids = _.uniq(user_ids);
					user_ids = _.without(user_ids, user._id.toString());

					// Convert back to ObjectIds
					user_ids = _.map(user_ids, function(id){
						return ObjectID(id);
					});

					// variable we'll return
					var returnUsers = [];

					// For each user, summarize
					// - last message
					// - read?

					var promises = [];

					user_ids.forEach(function(id){
						var def = Q.defer();
						promises.push(def.promise);

						var tmpUser = {
							_id: id,
							summary: {}
						};
						// Summarize for user
						console.info('-------UserSummary-------');
						m.Message.UserSummary(id, user._id)
						.then(function(summary){
							tmpUser.summary = summary;
							returnUsers.push(tmpUser);
							def.resolve();
						});

					});

					Q.all(promises)
					.then(function(){
						res.json(returnUsers);
					});
				});


			});

	});

	app.get('/messages/user/:user_id', function(req, res) {
		console.log("Summarizing messages for a user");

		checkUserAuth(req, res)
			.then(function(user){

				var id = ObjectID(req.params.user_id);

				m.Message.UserSummary(id, user._id)
				.then(function(summary){
					res.json({
						_id: id,
						summary: summary,
						_v: summary.last_message.created
					});
				});

			});

	});

	// app.get('/messages/player/:player_id', function(req, res) {
	// 	console.log("Finding all SPORTS for messages db for player");
		
	// 	checkUserAuth(req, res)
	// 		.then(function(user){
	// 			var playerId = ObjectID(req.params.player_id);

	// 			// var players_collection = models.mongo.collection('players');
	// 			// var messages_collection = models.mongo.collection('messages');

	// 			// Need to know if the player we're looking at is my PlayerHome
	// 			// - in which case we're getting all of the messages for my connected_user_id's too

	// 			var conditions = {_id: playerId, user_id: user._id};
	// 			m.Player.find(conditions, function(err, players){	
	// 			// players_collection.find({_id: playerId, user_id: user._id}).toArray(function(err, players) {

	// 				if(err){
	// 					res.status(500);
	// 					res.json([]);
	// 					return;
	// 				}

	// 				// Got the player?
	// 				if(players.length < 1){
	// 					res.status(404);
	// 					res.json(false);
	// 					return;
	// 				}

	// 				var player = players[0];

	// 				// Is the player Me?
	// 				var playerSearchObj = {};
	// 				if(player.is_me){

	// 					playerSearchObj = {"$or" : [{
	// 							_id: playerId, 
	// 							user_id : user._id
	// 						},{
	// 							connected_user_id: user._id
	// 						}]
	// 					};
	// 				} else {

	// 					playerSearchObj = {
	// 						_id: playerId, 
	// 						user_id : user._id
	// 					};
					
	// 				}

	// 				// players_collection.find(playerSearchObj).toArray(function(err, players) {
	// 				m.Player.find(playerSearchObj, function(err, players){

	// 					if(err || players.length < 1){
	// 						// res.status(404);
	// 						console.log(err);
	// 						console.log(players.length);
	// 						res.json(false);
	// 						return;
	// 					}

	// 					// Got players

	// 					// // Gather all the messages for a player
	// 					// // - also gathering all the Messages that I took driving another car
	// 					// // - we aren't expecting much overlap between the two
	// 					// messages_collection.find().toArray(function(err, items) {
	// 					// 	// res.json(items.splice(-10,10));
	// 					// 	res.json(items);
	// 					// });

	// 					// Gather all the messages for a player
	// 					// - also gathering all the Messages that I took driving another car
	// 					// - we aren't expecting much overlap between the two

	// 					// Get subset of messages and total results
	// 					var conditions = {player_id: { "$in" : _.pluck(players, '_id')}},
	// 						fields = null, // null = all fields
	// 						options = {
	// 							skip: req.query['$skip'] || 0, // skip
	// 							limit: req.query['$top'] || null, // limit
	// 							sort: {_id : -1}
	// 						};
	// 					if(req.query['$filter']){
	// 						conditions = {
	// 							'$and' : [conditions, JSON.parse(req.query['$filter'])]
	// 						};
	// 					}
	// 					var findResult = Q.defer();
	// 					m.Message.find(conditions,fields,options, function (err, results) {
	// 						if (err){ // TODO handle err
	// 							console.log('alt_models error');
	// 							return;
	// 						}
	// 						findResult.resolve(results);
	// 					})

	// 					var countResult = Q.defer();
	// 					m.Message.count(conditions, function (err, count) {
	// 						if(err){
	// 							console.log('Err 238947');
	// 						}
	// 						countResult.resolve(count);
	// 					})

	// 					Q.all([findResult.promise, countResult.promise])
	// 						.spread(function(results, totalResults){
	// 							res.json({
	// 								results: results,
	// 								total: totalResults
	// 							});
	// 						});


	// 				});


	// 			});

	// 		});

	// });


}