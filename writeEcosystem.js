const _ = require('lodash')
const fs = require('fs')

module.exports = (ecosystemPath, app) => {
  const apps = _.map(app, (d, name) => {
    let setting = {}
    setting.name = name
    if (_.isString(d)) {
      setting.script = d
    } else {
      setting = { ...setting, ...d }
    }
    return setting
  })

  const content = `
const apps = ${JSON.stringify(apps, null, 2)}

module.exports = {
  apps: apps.map(app => ({
    interpreter: process.env.NVM_DIR + '/nvm-exec',
    interpreter_args: 'node',
    log_date_format: '',
    env: {
      NODE_ENV: 'production',
      NODE_APP_INSTANCE: '',
    },
    ...app,
  })),
}
`
  fs.writeFileSync(ecosystemPath, content)
}
