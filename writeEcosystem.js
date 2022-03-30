const _ = require('lodash')
const fs = require('fs')
const path = require('path')

module.exports = ({ app, ecosystemPath }) => {
  const apps = _.map(app, (d, name) => {
    let setting = {}
    setting.name = name
    if (_.isString(d)) {
      setting.script = d
    } else {
      setting = { ...setting, ...d }
    }
    setting.cwd = setting.cwd || path.dirname(setting.script)
    return setting
  })

  const content = `
const apps = ${JSON.stringify(apps, null, 2)}

module.exports = {
  apps: apps.map(app => ({
    interpreter: process.env.NVM_DIR + '/nvm-exec',
    interpreter_args: 'node',
    log_date_format: '',
    ...app,
    env: {
      NODE_ENV: 'production',
      NODE_APP_INSTANCE: '',
      PORT: app.port,
      ...app.env,
    },
  })),
}
`
  fs.writeFileSync(ecosystemPath, content)
}
