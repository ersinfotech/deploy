#!/usr/bin/env node

const program = require('commander')
const { MultiSelect, Password } = require('enquirer')
const _ = require('lodash')
const shell = require('shelljs')
const Promise = require('bluebird')
const chalk = require('chalk')
const request = require('request-promise')
const retry = require('async-retry')
const moment = require('moment')
const Consul = require('consul')
const deployPath = require('./deployPath')
const writeEcosystem = require('./writeEcosystem')
const pkg = require('./package.json')

const config = require(deployPath)

program.version(pkg.version, '-v, --version')

program
  .command('app [name]')
  .option('--host <host>')
  .option('--all')
  .action(async (name, { host, all }) => {
    let names
    writeEcosystem(config)
    if (name) {
      const app = config.app[name]
      if (!app) {
        console.error(`${name} not exists`)
        return
      }
      names = _.castArray(name)
    } else {
      if (all) {
        names = _.keys(config.app)
      } else {
        try {
          const prompt = new MultiSelect({
            message: 'Select an app to restart',
            choices: _.keys(config.app),
          })
          names = await prompt.run()
        } catch (error) {
          return
        }
      }
    }
    for (const [hostName, ip] of Object.entries(config.host)) {
      if (host && host !== hostName) {
        continue
      }
      const appNames = _.reject(names, (name) => {
        const app = config.app[name]
        app.host = _.compact(_.castArray(app.host))
        if (!_.isEmpty(app.host) && !_.includes(app.host, hostName)) {
          return true
        }
      })
      for (const appName of appNames) {
        shell.exec(
          `ssh ${ip} pm2 startOrRestart ${config.ecosystemPath} --only ${appName}`
        )

        console.log('')

        const app = config.app[appName]
        if (app.port) {
          if (app.route) {
            const url = `http://${ip}:${app.port}${app.route}`
            try {
              await retry(
                async () => {
                  await request({
                    url,
                    timeout: 5000,
                  })
                },
                {
                  retries: app.retry || 6,
                }
              )
            } catch (error) {
              throw new Error(
                `${appName}@${hostName}: Failed to request ${url}`
              )
            }
            if (app.consul) {
              const consul = Consul({
                host: ip,
                promisify: true,
              })
              try {
                await consul.agent.service.register({
                  name: appName,
                  tags: ['prometheus'],
                  port: app.port,
                  check: {
                    http: url,
                    interval: '1m',
                    ttl: '2m',
                    deregistercriticalserviceafter: '1m',
                  },
                })
                console.log(`success to register ${appName} in consul`)
              } catch (error) {
                console.error(`failure to register ${appName} in consul`)
              }
            }
          }
        }
      }
    }
  })

program
  .command('run [command...]')
  .option('--host <host>')
  .action((command, { host }) => {
    for (const [hostName, ip] of Object.entries(config.host)) {
      if (host && host !== hostName) {
        continue
      }
      console.log(chalk.green(`${hostName} run output:`))
      shell.exec(`ssh ${ip} ${command.join(' ')}`)
    }
  })

program
  .command('sudo [command...]')
  .option('--host <host>')
  .action(async (command, { host }) => {
    const prompt = new Password({
      message: '[sudo] password:',
    })
    const password = await prompt.run()
    for (const [hostName, ip] of Object.entries(config.host)) {
      if (host && host !== hostName) {
        continue
      }
      console.log(chalk.green(`${hostName} sudo output:`))
      const {
        stdout,
      } = shell.exec(
        `echo ${password} | ssh -tt ${ip} sudo ${command.join(' ')}`,
        { silent: true }
      )
      console.log(
        stdout
          .replace(/^.*\r\n/, '')
          .replace(/^.*\r\n/, '')
          .trim()
      )
    }
  })

program
  .command('nginx')
  .option('--host <host>')
  .action(async ({ host }) => {
    const { code } = shell.exec(`sudo nginx -t`, {
      silent: true,
    })
    if (code !== 0) {
      console.error(`nginx test fail`)
      return
    }
    for (const [hostName, ip] of Object.entries(config.host)) {
      if (host && host !== hostName) {
        continue
      }
      shell.exec(`sudo systemctl -H ${ip} reload nginx`, { silent: true })
      console.log(`${hostName} nginx reload`)
    }
  })

program.parse(process.argv)
