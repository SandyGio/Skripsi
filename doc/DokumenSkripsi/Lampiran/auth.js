const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
});

client.connect();

const credentials = {
  client: {
    id: process.env.APP_ID,
    secret: process.env.APP_PASSWORD,
  },
  auth: {
    tokenHost: 'https://login.microsoftonline.com',
    authorizePath: 'common/oauth2/v2.0/authorize',
    tokenPath: 'common/oauth2/v2.0/token'
  }
};

const credentialsSlack = {
  client: {
    id: process.env.SLACK_CLIENT_ID,
    secret: process.env.SLACK_CLIENT_SECRET,
  },
  auth: {
    tokenHost: 'https://slack.com',
    authorizePath: 'oauth/authorize',
    tokenPath: 'api/oauth.access'
  }
};
const oauth2 = require('simple-oauth2').create(credentials);
const oauth2Slack = require('simple-oauth2').create(credentialsSlack);
const jwt = require('jsonwebtoken');
const databaseValue={};


//Microsoft Auth Helper
function getAuthUrl() {
  const returnVal = oauth2.authorizationCode.authorizeURL({
    redirect_uri: process.env.REDIRECT_URI,
    scope: process.env.APP_SCOPES
  });
  return returnVal;
}

//Change Code to Token Microsoft
async function getTokenFromCode(auth_code) {
  let result = await oauth2.authorizationCode.getToken({
    code: auth_code,
    redirect_uri: process.env.REDIRECT_URI,
    scope: process.env.APP_SCOPES
  });

  const token = oauth2.accessToken.create(result);
  const user = jwt.decode(token.token.id_token);
  token.token.userData=user;

  //token dari sini menampung Microsoft username, accessToken, refreshToken, dan expires masing2.
  databaseValue.microsoft_username=token.token.userData.preferred_username;
  databaseValue.microsoft_access_token_expires=token.token.expires_in;
  databaseValue.microsoft_access_token=token.token.access_token;
  databaseValue.microsoft_refresh_token=token.token.refresh_token;
  databaseValue.login_timestamp=new Date().getTime();

  return token.token.access_token;
}


//Slack Auth Helper
function getAuthUrlSlack() {
  const returnVal = oauth2Slack.authorizationCode.authorizeURL({
    client_id:process.env.SLACK_CLIENT_ID,
    redirect_uri: process.env.SLACK_REDIRECT_URI,
    scope: process.env.SLACK_APP_SCOPES
  });
  return returnVal;
}

//Change Code to Token Slack
async function getTokenFromCodeSlack(auth_code) {
  let result = await oauth2Slack.authorizationCode.getToken({
    code: auth_code,
    redirect_uri: process.env.SLACK_REDIRECT_URI,
    client_id:process.env.SLACK_CLIENT_ID,
    client_secret: process.env.SLACK_CLIENT_SECRET
  });

  const token = oauth2Slack.accessToken.create(result);
  databaseValue.slack_access_token=token.token.access_token;

  client.query('SELECT * FROM public."Credentials";', (err, res) => {
    const arrResult=res.rows;
    var valueForInsert=[databaseValue.microsoft_username, databaseValue.microsoft_refresh_token, databaseValue.microsoft_access_token_expires, databaseValue.microsoft_access_token, databaseValue.slack_access_token, databaseValue.login_timestamp];
    var updated=0;
    var queryText='';

    arrResult.forEach(row =>{
      if(row.microsoft_username==databaseValue.microsoft_username){
        //Jika sudah ada record untuk username microsoft ini, maka perangkat lunak hanya melakukan update.
        queryText='UPDATE public."Credentials" SET microsoft_refresh_token=$2, microsoft_access_token_expires=$3, microsoft_access_token=$4, slack_access_token=$5, login_timestamp=$6 WHERE microsoft_username=$1 RETURNING *';

        client.query(queryText, valueForInsert, (err, res) => {
          if (err) {
            console.log(err.stack)
          } else {
            console.log(res.rows)
          }
        });
        //Flag update menjadi 1.
        updated=1;
      }
    })

    //Jika belum ada, maka memasukkan data ke dalam database dengan bantuan membaca flag.
    if (updated!=1) {
      queryText='INSERT INTO public."Credentials" (microsoft_username, microsoft_refresh_token, microsoft_access_token_expires, microsoft_access_token, slack_access_token, login_timestamp) VALUES ($1, $2, $3, $4, $5, $6)';

      client.query(queryText, valueForInsert, (err, res) => {
        if (err) {
          console.log(err.stack)
        } else {
          console.log(res.rows[0])
        }
      });
    }
  });

  return token.token.access_token;
}

exports.getTokenFromCode = getTokenFromCode;
exports.getAuthUrl = getAuthUrl;

exports.getTokenFromCodeSlack = getTokenFromCodeSlack;
exports.getAuthUrlSlack = getAuthUrlSlack;
