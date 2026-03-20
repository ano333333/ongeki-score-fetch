{
  inputs = { nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable"; };

  outputs = { self, nixpkgs, }:
    let
      systems = [ "x86_64-linux" "aarch64-darwin" ];
      gen = nixpkgs.lib.genAttrs;
    in {
      devShells = gen systems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          browsers = (builtins.fromJSON (builtins.readFile
            "${pkgs.playwright-driver}/browsers.json")).browsers;
          chromium-revision = (builtins.head
            (builtins.filter (x: x.name == "chromium") browsers)).revision;
          chromiumPath = if pkgs.stdenv.isLinux then
            "${pkgs.playwright-driver.browsers}/chromium-${chromium-revision}/chrome-linux/chrome"
          else
            "${pkgs.playwright-driver.browsers}/chromium-${chromium-revision}/chrome-mac/Chromium.app/Contents/MacOS/Chromium";
        in {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_24
              nodePackages.pnpm
              playwright-driver.browsers
            ];
            shellHook = ''
              echo "entered devShell"

              export PATH="chrome-extension/node_modules/.bin:$PATH"

              # playwrightにNixのパスを渡す
              export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
              export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
              export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true
              export PLAYWRIGHT_NODEJS_PATH="${pkgs.nodejs_24}/bin/node"
              export PLAYWRIGHT_LAUNCH_OPTIONS_EXECUTABLE_PATH="${chromiumPath}"
            '';
          };
        });
    };
}

