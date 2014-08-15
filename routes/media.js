
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId;

// Uploading
var transloadit = require('node-transloadit');
// var transloadit_client = new transloadit('95732a30f4fe11e399878736040b2fba', 'secretdd587b8d11a9dc48fc25ade2cafb8d9c46eb3545');

module.exports = function(app) {
  	
	app.get('/media/game/:game_id', function(req, res) {
		console.log("Media for game Feed");

		checkUserAuth(req, res)
			.then(function(user){
				var gameId = ObjectID(req.params.game_id);
				m.Game.findOne({ _id: gameId })
				.populate('media')
				.exec(function(err, Game) {
					if(err){
						console.error(err);
						res.status(500);
						res.json(false);
						return;
					}

					var media = Game.toJSON().media;
					var tmpMediaListIds = [];
					media.forEach(function(tmpMedia){
						if(tmpMedia.active !== true){
							return;
						}
						if(tmpMedia.assembled !== true){
							return;
						}
						// console.log('---tmpMedia');
						// console.log(tmpMedia);
						tmpMediaListIds.push(tmpMedia._id);
					});

					// Return Media array

					// Use pagination to search

					// Get subset of media and total results
					var conditions = {
						_id: {
							'$in' : tmpMediaListIds
						}
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

					var findResult = Q.defer();
					m.Media.find(conditions,fields,options)
					.populate('user_id')
					.exec(function (err, results) {
						if (err){ // TODO handle err
							console.log('alt_models error');
							return;
						}
						findResult.resolve(results);
					});

					var countResult = Q.defer();
					m.Media.count(conditions, function (err, count) {
						if(err){
							console.log('Err 238947');
						}
						countResult.resolve(count);
					});

					Q.all([findResult.promise, countResult.promise])
						.spread(function(results, totalResults){
							// return to client
							res.json({
								results: results,
								total: totalResults
							});
						});


					// res.json(tmpMediaList);

				});
			});
			
	});


	app.get('/media/player/:player_id?', function(req, res) {
		console.log("Finding MEDIA for a player");

		checkUserAuth(req, res)
			.then(function(user){

				// Finding for this user, or another player?
				var conditions = {};
				if(req.params.player_id){
					conditions = {_id : ObjectID(req.params.player_id)}
				} else {
					conditions = {user_id : user._id, is_me: true}
				}

				m.Player.findOne(conditions)
				.exec(function(err, Player){
					if(err || !Player){
						console.error(err);
						res.status(500);
						res.json(false);
						return;
					}

					// Find media for that player

					// must be an "is_me"
					if(Player.is_me !== true){
						console.log('Player not is_me===true');
						// res.status(500);
						res.json([]);
						return;
					}

					// - use that user_id

					// Get subset of media and total results
					var conditions = {
						user_id: Player.user_id,
						assembled: true,
						// active: true
					};

					// console.log('----------111111111-------');
					// console.log(conditions);
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

					var findResult = Q.defer();
					m.Media.find(conditions,fields,options)
					.populate('user_id')
					.exec(function (err, results) {
						if (err){ // TODO handle err
							console.log('alt_models error');
							return;
						}
						findResult.resolve(results);
					});

					var countResult = Q.defer();
					m.Media.count(conditions, function (err, count) {
						if(err){
							console.log('Err 238947');
						}
						countResult.resolve(count);
					});

					Q.all([findResult.promise, countResult.promise])
						.spread(function(results, totalResults){
							// return to client
							res.json({
								results: results,
								total: totalResults
							});
						});



					// m.Media.find({
					// 	user_id: Player.user_id,
					// 	assembled: true,
					// 	active: true
					// })
					// // .populate('user_id connected_user_id')
					// .exec(function(err, media) {
					// 	if(err){
					// 		console.error('Error: 32489jsdf');
					// 		console.error(err);
					// 		res.status(500);
					// 		res.json(false);
					// 		return;
					// 	}
						
					// 	// Return to client
					// 	res.json(media);


					// });

				});
			});
	});

	app.post('/media/profilephoto_transloadit', function(req, res){
		console.log("TRANSLOADIT REQUEST");

		var parsed = JSON.parse(req.body.transloadit);

		// Find the media we stored, update them
		m.Media.findOne({assembly_id: parsed.assembly_id})
		.exec(function(err, Media){
			if(err){
				console.error(err);
				res.status(500);
				res.json(false);
				return;
			}

			// Update Media with new parameters
			Media.assembly_results = parsed.results;
			Media.assembled = true;

			// Parse out the urls/paths we care about
			Media.urls = {
				original : parsed.results[':original'][0].ssl_url,
				thumb100x100 : parsed.results['cropped_thumb'][0].ssl_url,
				thumb300x300 : parsed.results['cropped_thumb_big'][0].ssl_url
			};

			Media.save(function(err, newMedia){
				if(err){
					console.error(err);
					res.status(500);
					res.json(false);
					return;
				}

				// return to transloadit client
				console.log('Success modifying Media');
				console.log(newMedia);
				res.send(200);
				// res.json(newMedia);
			});

		});

	});


	app.post('/media/profilephoto', function(req, res){
		// Uploading media to a game
		console.log('Uploading media for my profilephoto');

		// Uses transload-it to:
		// - store original on S3
		// - crop and resize to a thumbnail
		// - store thumb on s3

		// notified on completion at /game/media_transloadit

		checkUserAuth(req, res, req.body.token)
			.then(function(user){
				// My player?
				console.log('media upload passed checkUserAuth');
				var player_id = ObjectID(req.body.player_id);
				console.log(player_id);
				m.Player.findOne({ _id: player_id })
				.exec(function(err, Player) {
					if(err){
						console.error('Error');
						console.error(err);
						res.status(500);
						res.json(false);
						return;
					}

					if(!Player){
						console.error('No Player!');
						res.status(404);
						res.json(false);
						return;
					}

					// Must be me!
					if(Player.is_me !== true){
						console.error('Not is_me for profilephoto');
						res.status(404);
						res.json(false);
						return;
					}
					if(Player.user_id.toString() != user._id.toString()){
						console.error('Not my user_id for profilephoto');
						res.status(404);
						res.json(false);
						return;
					}

					console.log("uploading media for profilephoto...");

					var file = req.files.file,
						filePath = file.path,
						// fileName = file.name, file name passed by client. Not used here. We use the name auto-generated by Node
						lastIndex = filePath.lastIndexOf("/"),
						tmpFileName = filePath.substr(lastIndex + 1),
						extra = req.body.extra;
						// images = db.collection('images');

					// extra.fileName = tmpFileName;
					console.log(tmpFileName);

					var Media = new m.Media({
						user_id: user._id,
						player_id: Player._id,

						assembled: false,
						active: true,

						type: 'image',
						filename: tmpFileName,

						extra: extra
					});

					Media.save(function (err, newMedia) {
						if (err) {
							console.log(err);
							return next(err);
						}
						// console.log('result');
						// console.log(newMedia);
						res.json(newMedia);

						// Transload-it
						// var client = new transloadit('AUTH_KEY', 'AUTH_SECRET');
						var transloadit_client = new transloadit('95732a30f4fe11e399878736040b2fba', 'dd587b8d11a9dc48fc25ade2cafb8d9c46eb3545');
						var params = {
							notify_url: 'https://nemesisserver1.herokuapp.com/media/profilephoto_transloadit',
						    steps: {
						        // ':original': {
						        //     robot: '/http/import',
						        //     url: 'http://example.com/file.mov'
						        // },
								store_original: {
									"robot": "/s3/store",
									"key": "AKIAIPYK6RLTEGVYCVCA",
									"secret": "zzDKS5rqhw/ag3oWg3o8b6hOs/LJ8XcmoLn8m+sM",
									"bucket": "nemesismedia1",
									path: 'profilephotos/' + Player._id.toString() + '/original/${file.url_name}',
									use: ":original"
								},
						        cropped_thumb: {
						          robot: "/image/resize",
						        	use: ':original',
						          width: 100,
						          height: 100,
						          resize_strategy: "crop",
						          format: "png",
						          strip: true
						        },
						        cropped_thumb_big: {
						          robot: "/image/resize",
						        	use: ':original',
						          width: 300,
						          height: 300,
						          resize_strategy: "crop",
						          format: "png",
						          strip: true
						        },
								store_thumb: {
									"robot": "/s3/store",
									use: "cropped_thumb",
									"key": "AKIAIPYK6RLTEGVYCVCA",
									"secret": "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",
									"bucket": "nemesismedia1",
									path: 'profilephotos/' + Player._id.toString() + '/thumb/${file.url_name}',
								},
								store_thumb_big: {
									"robot": "/s3/store",
									use: "cropped_thumb_big",
									"key": "AKIAIPYK6RLTEGVYCVCA",
									"secret": "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",
									"bucket": "nemesismedia1",
									path: 'profilephotos/' + Player._id.toString() + '/thumb_big/${file.url_name}',
								}
						    },
						    // template_id: 'your_template_id_here'
						};

						// Add file to stream
						// - could also do client.addStream instead, to upload-in-progress?
						transloadit_client.addFile(tmpFileName, filePath);

						transloadit_client.send(params, function(tResponse) {
						    // success callback [optional]
						    console.log('Success: ');
						    console.log(tResponse);
						    console.log('RESULTS');
						    console.log(tResponse.results);

						    // Update our media with this data
						    newMedia.assembly_id = tResponse.assembly_id;
						    newMedia.save(function(err, newNewMedia){
						    	if(err){
						    		console.log('error with newNewMedia');
						    		console.error(newNewMedia);
						    		return;
						    	}
						    });

						}, function(err) {
						    // error callback [optional]
						    console.log('Error: ' + JSON.stringify(err));
						});
						// client.addStream(name, stream);
						// client.addFile(file_name, file_path);
						// client.send(params, ok_callback, fail_callback);


						// Update the profile photo to point at this media!
						console.log('Updating Player.profilephoto to point at this media', newMedia._id);
						Player.profilephoto = newMedia._id;
						Player.save(function(err, newPlayer){
							if(err){
								console.error('newPlayer update FAILED');
								return;
							}
							console.log('newPlayer is now');
							// console.log(newPlayer);
						});

						// Update the User's profile photo to point at this media!
						console.log('Updating User.profilephoto to point at this media', newMedia._id);
						user.profilephoto = newMedia._id;
						user.save(function(err, newUser){
							if(err){
								console.error('newPlayer update FAILED');
								return;
							}
							console.log('newUser is now');
							// console.log(newUser);
						});

					});



				});


			});
	});


}