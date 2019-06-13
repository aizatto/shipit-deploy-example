import * as deploymentTasks from "shipit-deploy";
import extendShipit from "shipit-deploy/lib/extendShipit";
import * as JSON5 from "json5";
import * as fs from "fs-extra";

const enum ConfigKeys {
  CURRENT_PATH = "currentPath",
  DEPLOY_TO = "deployTo",
  RELEASE_PATH = "releasePath"
}

const sharedFiles = [
  'packages/www-assets/.env',
];

const PM2_APP_NAME = "deepthought";

export default async function(shipit) {
  deploymentTasks(shipit);
  const config = new Map<ConfigKeys, string>();
  function updateConfig(key: ConfigKeys) {
    config.set(key, shipit[key]);
  }

  const json5 = await fs.readFile("./config.json5");

  shipit.initConfig(JSON5.parse(json5));
  config.set(ConfigKeys.DEPLOY_TO, shipit.config[ConfigKeys.DEPLOY_TO]);

  async function execRemote(command: string, options = { cwd: null }) {
    if (!options.cwd) {
      const cwd = config.get(ConfigKeys.RELEASE_PATH);
      options.cwd = cwd;
    }

    await shipit.remote(`${command}`, options);
  }

  shipit.on("rollback:init", () => {
    updateConfig(ConfigKeys.CURRENT_PATH);
  });

  // shipit.on doesn't block
  shipit.on("updated", () => {
    updateConfig(ConfigKeys.CURRENT_PATH);
    updateConfig(ConfigKeys.RELEASE_PATH);
    shipit.start(["copy", "build"]);
  });

  shipit.blTask("copy", async () => {
    const promises = [];
    promises.push(async () => {
      await execRemote(`mkdir -p ${config.get(ConfigKeys.DEPLOY_TO)}/shared/`);
    });
    const DEPLOY_PATH = config.get(ConfigKeys.DEPLOY_TO);
    const RELEASE_PATH = config.get(ConfigKeys.RELEASE_PATH);
    promises.push(
      ...sharedFiles.map(async file => {
        await execRemote(
          `cp ${DEPLOY_PATH}/shared/${file} ${RELEASE_PATH}/${file}`
        );
      })
    );
    await Promise.all(promises);
  });

  shipit.blTask("build", async () => {
    await execRemote(`yarn run lerna link`);
    await execRemote(`yarn install`);
    await execRemote(`yarn build`);
  });

  shipit.blTask("pm2:start", async () => {
    if (!config.has(ConfigKeys.CURRENT_PATH)) {
      extendShipit(shipit);
      updateConfig(ConfigKeys.CURRENT_PATH);
    }

    const path = `${config.get(ConfigKeys.CURRENT_PATH)}/packages/www-server/`;
    return execRemote(
      `NODE_ENV=production PORT=3001 pm2 start yarn --interpreter sh --name ${PM2_APP_NAME} -- start`,
      {
        cwd: path
      }
    );
  });

  shipit.blTask("pm2:stop", async () => {
    return execRemote(`pm2 stop ${PM2_APP_NAME}`);
  });

  shipit.blTask("pm2:delete", async () => {
    return execRemote(`pm2 delete ${PM2_APP_NAME}`);
  });

  shipit.blTask("pm2:status", async () => {
    shipit.remote("pm2 jlist").then(servers => {
      servers.forEach(server => {
        const json = JSON.parse(server.stdout).find(
          pm2 => pm2["name"] === PM2_APP_NAME
        );
        if (json) {
          console.log(json["pm2_env"]["status"]);
        } else {
          console.log(`Cannot find status`);
        }
      });
    });
  });

  /**
   * Because pm2:start depends on the current path, this should not be called directly
   */
  shipit.blTask("pm2:restart", async () => {
    shipit.remote("pm2 jlist").then(servers => {
      // TODO: handle on multiple servers
      servers.forEach(server => {
        const jlist = server.stdout;
        const json = JSON5.parse(jlist);
        const exists = json.find(pm2 => pm2["name"] === PM2_APP_NAME);
        if (exists) {
          shipit.start(["pm2:stop", "pm2:delete", "pm2:start"]);
        } else {
          shipit.start("pm2:start");
        }
      });
    });
  });

  shipit.on("deployed", async () => {
    shipit.start("pm2:restart");
  });
}
