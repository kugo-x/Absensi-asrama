<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sistem Absensi Asrama UNAND</title>
    <meta name="description" content="Sistem Informasi Absensi dan Manajemen Penghuni Asrama Universitas Andalas">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <?php
      $jsFile = 'assets/index-BMgMyQcY.js';
      $cssFile = 'assets/index-CmpVw8hf.css';
      // Dynamically locate newest built assets if available (by modification time)
      $assetsDir = FCPATH . 'assets/';
      $newest = static function (string $pattern): ?string {
          $files = glob($pattern) ?: [];
          usort($files, static fn ($a, $b) => filemtime($b) <=> filemtime($a));
          return $files ? 'assets/' . basename($files[0]) : null;
      };
      $jsFile  = $newest($assetsDir . '*.js') ?? $jsFile;
      $cssFile = $newest($assetsDir . '*.css') ?? $cssFile;
    ?>
    <script type="module" crossorigin src="<?= base_url($jsFile) ?>"></script>
    <link rel="stylesheet" crossorigin href="<?= base_url($cssFile) ?>">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
