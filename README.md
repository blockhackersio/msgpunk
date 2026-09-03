
### Client

Everything in the `./client` folder is for the android client app.

To load it's environment you should use `devenv`.

You can use `direnv` to load `devenv` with `direnv allow` on supported systems.

Otherwise you should be able to get a shell using `direnv shell`.

Building the client project with it's apks.

```
cd ./client
pnpm install
cargo tauri android build
```

Runnning this in dev mode on a device.

```
cargo tauri android dev --host 127.0.0.1
```


