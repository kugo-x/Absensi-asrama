<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');

$routes->group('api', static function ($routes) {
    // Auth
    $routes->post('auth/login', 'Api\AuthController::login');
    $routes->post('auth/change-password', 'Api\AuthController::changePassword');
    $routes->post('auth/profile-photo', 'Api\AuthController::profilePhoto');
    $routes->post('auth/profile', 'Api\AuthController::profile');
    $routes->options('auth/login', static function () {
        return response()->setStatusCode(200);
    });

    // Jalankan seeder database
    $routes->get('seed', 'Api\DataController::runSeeder');
    $routes->post('seed', 'Api\DataController::runSeeder');

    // Semua endpoint data wajib membawa token hasil login.
    $routes->group('', ['filter' => 'api-auth'], static function ($routes) {
        // Master Data
        $routes->get('gedung', 'Api\DataController::getGedung');
        $routes->post('gedung/add', 'Api\DataController::addGedung');
        $routes->post('gedung/update', 'Api\DataController::updateGedung');
        $routes->post('gedung/delete', 'Api\DataController::deleteGedung');
        $routes->post('gedung/pj', 'Api\DataController::setPjGedung');
        $routes->get('kamar', 'Api\DataController::getKamar');
        $routes->post('kamar/add', 'Api\DataController::addKamar');
        $routes->post('kamar/update', 'Api\DataController::updateKamar');
        $routes->post('kamar/delete', 'Api\DataController::deleteKamar');

        // Event Asrama
        $routes->get('event', 'Api\EventController::getEvent');
        $routes->post('event/add', 'Api\EventController::addEvent');
        $routes->post('event/update', 'Api\EventController::updateEvent');
        $routes->post('event/delete', 'Api\EventController::deleteEvent');
        $routes->get('event/rekap/(:num)', 'Api\EventController::rekapEvent/$1');
        $routes->post('event/absen', 'Api\EventController::absenEvent');
        $routes->get('event/foto/(:segment)', 'Api\EventController::fotoEvent/$1');
        $routes->get('event/sampul/(:segment)', 'Api\EventController::sampulEvent/$1');
        $routes->get('event/foto-validasi', 'Api\EventController::fotoValidasiEvent');
        $routes->post('event/validasi-foto', 'Api\EventController::validasiFotoEvent');
    
    // Penghuni
    $routes->get('penghuni', 'Api\DataController::getPenghuni');
    $routes->post('penghuni', 'Api\DataController::addPenghuni');
    $routes->post('penghuni/toggle-status', 'Api\DataController::togglePenghuniStatus');
    $routes->post('penghuni/update', 'Api\DataController::updatePenghuni');
    $routes->post('penghuni/reset-password', 'Api\DataController::resetPassword');

    // Presensi
    $routes->get('presensi', 'Api\DataController::getPresensi');
    $routes->post('presensi', 'Api\DataController::checkIn');
    $routes->post('presensi/koreksi', 'Api\DataController::koreksiPresensi');
    $routes->post('presensi/validasi-foto', 'Api\DataController::validasiFoto');
    $routes->post('presensi/validasi-foto-massal', 'Api\DataController::validasiFotoMassal');
    $routes->get('presensi/foto/(:segment)', 'Api\DataController::fotoWajah/$1');

    // Izin
    $routes->get('izin', 'Api\DataController::getIzin');
    $routes->post('izin', 'Api\DataController::addIzin');
    $routes->post('izin/status', 'Api\DataController::updateIzinStatus');
    $routes->post('izin/batal', 'Api\DataController::batalIzin');
    $routes->get('izin/bukti/(:segment)', 'Api\DataController::buktiIzin/$1');

    // Pengaturan sesi & hari libur
    $routes->get('sesi', 'Api\PengaturanController::getSesi');
    $routes->post('sesi', 'Api\PengaturanController::saveSesi');
    $routes->post('sesi-gedung', 'Api\PengaturanController::saveSesiGedung');
    $routes->get('libur', 'Api\PengaturanController::getLibur');
    $routes->post('libur', 'Api\PengaturanController::addLibur');
    $routes->post('libur/delete', 'Api\PengaturanController::deleteLibur');
    $routes->post('libur/update', 'Api\PengaturanController::updateLibur');
    $routes->get('mode-uji', 'Api\PengaturanController::getModeUji');
    $routes->post('mode-uji', 'Api\PengaturanController::saveModeUji');
    $routes->get('aturan-presensi', 'Api\PengaturanController::getAturanPresensi');
    $routes->post('aturan-presensi', 'Api\PengaturanController::saveAturanPresensi');

    // Log aktivitas (admin, hanya baca)
    $routes->get('log', 'Api\LogController::index');

    });

    // Generic OPTIONS handler for CORS preflight
    $routes->options('(:any)', static function () {
        return response()->setStatusCode(200);
    });
});
