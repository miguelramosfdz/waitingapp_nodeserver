// set up mongoose
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var bcrypt;
try {
  bcrypt = require('bcrypt');
  console.log('Using BCRYPT normal (might switch to bcrypt-nodejs later, for node v.11');
}catch(err){
  console.log('No bcrypt, using bcrypt-nodejs (gonna fail in comparePassword)');
  console.log(err);
  bcrypt = require('bcrypt-nodejs');
}

var ObjectId = Schema.ObjectId;

var schema = Schema({

  active: { type: Boolean },

  email: { type: String, lowercase: true },
  username: { type: String, default: null, unique: true }, // unique usernames
  username_lowercase: { type: String, default: null, unique: true, lowercase: true }, // unique usernames
  password: { type: String },
  password_default: { type: Boolean },

  friends: [
    { type: ObjectId, ref: 'users' }
  ],

  created: { type: Date },
  modified: { type: Date },

  android: [{
    reg_id: { type: String },
    last: { type: String },
  }],
  // ios: [{
  //   reg_id: { type: String },
  //   last: { type: String },
  // }],

  ios: { type: Array },

  profilephoto: { type: ObjectId, ref: 'media' },
  
  profile: {
    name: { type: String, default: '' },
    gender: { type: String, default: '' },
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    picture: { type: String, default: '' }
  },

  resetPasswordToken: String,
  resetPasswordExpires: Date,

  flags: { type: Object } // random flags we'll set per-user (they can change them at-well, basically)

});

schema.pre('save', function(next) {
  var user = this;

  console.log('preSave');

  if (!user.isModified('password')){
    console.log('!isModified');
    return next();
  }

  bcrypt.genSalt(5, function(err, salt) {
    if (err){
      return next(err);
    }
    bcrypt.hash(user.password, salt, function(err, hash) {
      if (err){
        return next(err);
      }
      user.password = hash;
      next();
    });
  });
});

schema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

var userModel = mongoose.model('users', schema);

exports.userModel = userModel;

