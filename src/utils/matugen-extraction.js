import Gio from "gi://Gio";

export function runMatugen(imagePath, onSuccess, onError) {
  try {
    const proc = Gio.Subprocess.new(
      ["matugen", "image", imagePath],
      Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    );

    proc.communicate_utf8_async(null, null, (source, result) => {
      try {
        const [, stdout, stderr] = source.communicate_utf8_finish(result);
        const exitCode = source.get_exit_status();

        if (exitCode !== 0) {
          console.error("Matugen stderr:", stderr);
          onError(
            new Error(`Matugen failed with exit code ${exitCode}: ${stderr}`),
          );
          return;
        }

        console.log("Matugen output:", stdout);
        onSuccess(null);
      } catch (e) {
        onError(e);
      }
    });
  } catch (e) {
    onError(e);
  }
}
