process.env.PORT = 3002;
const app = require('./index');
const PORT = 3002;
app.listen(PORT, () => {
  console.log('Updated ProActur Backend listening on port ' + PORT);
});
