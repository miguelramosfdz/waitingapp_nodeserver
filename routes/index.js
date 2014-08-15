module.exports = function(app) {

	app.get('/', function(req, res) {
		res.render("index", { pageTitle: "Nemisis"});
	});

  // require('./action')(app);
  // require('./feed')(app);
  // require('./game')(app);
  // require('./game_star')(app);
  require('./media')(app);
  require('./message')(app);
  require('./push')(app);
  // require('./notification')(app);
  // require('./player')(app);
  require('./relationship_code')(app);
  // require('./sport')(app);
  // require('./story')(app);
  require('./user')(app);


  app.get('/push_settings', function(req, res){
    console.log('push test');

    // Updates Push Settings for all the users
    m.User.find({},'_id')
    .exec(function(err, users){
      // console.log(users);
      if(err){
        console.error(err);
        return;
      }

      users.forEach(function(user){

        // find/create PushSettings
        m.PushSetting.findOne({user_id: user._id})
        .exec(function(err, PS){
          if(err){
            console.error(err);
            return;
          }

          if(!PS){
            // create

            // Create default Push Settings for user
            var PushSetting = new m.PushSetting({
              user_id : user._id
            });
            // Insert
            PushSetting.save(function(err, newPushSetting){
              if(err){
                console.error('PushSetting error');
                console.error(err);
                return;
              }

              // Saved PushSetting OK
              console.log('Saved PushSetting');

            });
          } else {
            // Modify
            // - add any missing values

            var defaults = [
              'new_friend',
              'new_message'
            ];

            var UpdatePS = false;
            defaults.forEach(function(defa){

              try {
                if(PS.scheme[defa] === undefined){
                  console.log(1);
                  UpdatePS = true;
                  PS.scheme[defa] = true; // default is always "true"?
                } else {
                  console.log(PS.scheme);
                }
              }catch(err){
                console.error(err);
              }

            });

            if(UpdatePS){
              PS.save(function(err, newPS){
                if(err){
                  console.error('failed updating PS');
                  console.error(err);
                  return;
                }
                console.log('updated PS');
              });
            } else {
              console.log('no update');
            }

          }

        });

      });

    });

    res.json(true);

  });

}