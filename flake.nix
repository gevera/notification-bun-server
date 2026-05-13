{
  description = "Website Notification Relay — Micro SaaS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          bun
          sqlite
        ];

        shellHook = ''
          echo "Notification Relay dev shell ready"
        '';
      };
    };
}
