export function About() {
  const deploymentVersion = "[[[VERSION]]]"; // Will be replaced during deploy
  const version = deploymentVersion.startsWith("[[[") ? "dev" : deploymentVersion;
  return (
    <section>
      <div>
        Card Press • Version [{version}] • Made with ♥ by <a href="https://luan.xyz">Luan Nico</a> @ 2026
      </div>
      <div>
        Check out the source code on <a href="https://github.com/luanpotter/card-press">GitHub</a>.
      </div>
      <div>Leave us a star or contribute if you found it useful!</div>
      <hr />
      <div>A fully client-side webapp for generating print-then-cut PDFs for playing cards.</div>
      <div>Cricut instructions coming soon!</div>
    </section>
  );
}
