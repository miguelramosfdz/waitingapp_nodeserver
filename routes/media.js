
var _ 		= require('underscore'),
	Q 		= require('q'),
	urlLib 	= require('url'),
	moment 	= require('moment'), // moment.js (date parsing/formatting)
	ObjectID = require('mongojs').ObjectId;

// Uploading
var transloadit = require('node-transloadit');
// var transloadit_client = new transloadit('95732a30f4fe11e399878736040b2fba', 'secretdd587b8d11a9dc48fc25ade2cafb8d9c46eb3545');

module.exports = function(app) {
  	

	app.post('/media/profilephoto_transloadit', function(req, res){
		console.log("TRANSLOADIT REQUEST");

		var parsed = JSON.parse(req.body.transloadit);
		console.log('parsed');
		console.log(parsed);
		
		// Error?
		if(parsed.error){
			errorhandler('Failed converting photo', res);
			return;
		}

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
		// Uploading photo for profile
		console.log('Uploading media for my profilephoto');

		// Uses transload-it to:
		// - store original on S3
		// - crop and resize to a thumbnail
		// - store thumb on s3

		// notified on completion at /game/media_transloadit

		checkUserAuth(req, res, req.body.token)
			.then(function(user){
				

				console.log("uploading media for profilephoto...");

				var file = req.files.file,
					filePath = file.path,
					// fileName = file.name, file name passed by client. Not used here. We use the name auto-generated by Node
					lastIndex = filePath.lastIndexOf("/"),
					tmpFileName = filePath.substr(lastIndex + 1),
					extra = req.body.extra;

				// extra.fileName = tmpFileName;
				console.log(tmpFileName);

				var Media = new m.Media({
					user_id: user._id,

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

					// Return new Media obj (not gone through Transload.it yet) 
					res.json(newMedia);

					// Transload-it
					// var client = new transloadit('AUTH_KEY', 'AUTH_SECRET');
					var transloadit_client = new transloadit(config.get('transloadit_key'), config.get('transloadit_secret'));
					var params = {
						notify_url: config.get('server_media_root') + 'media/profilephoto_transloadit',
					    steps: {
					        // ':original': {
					        //     robot: '/http/import',
					        //     url: 'http://example.com/file.mov'
					        // },
							store_original: {
								"robot": "/s3/store",
								"key": config.get('aws_access_key'),
								"secret": config.get('aws_access_secret'),
								"bucket": config.get('aws_bucket_photos'),
								path: 'profilephotos/' + user._id.toString() + '/original/${file.url_name}',
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
								"key": config.get('aws_access_key'),
								"secret": config.get('aws_access_secret'),
								"bucket": config.get('aws_bucket_photos'),
								path: 'profilephotos/' + user._id.toString() + '/thumb/${file.url_name}',
							},
							store_thumb_big: {
								"robot": "/s3/store",
								use: "cropped_thumb_big",
								"key": config.get('aws_access_key'),
								"secret": config.get('aws_access_secret'),
								"bucket": config.get('aws_bucket_photos'),
								path: 'profilephotos/' + user._id.toString() + '/thumb_big/${file.url_name}',
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


}