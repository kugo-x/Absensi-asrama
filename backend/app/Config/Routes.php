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

    // Semua endpoint data wajib membawa token hasil login.
    $routes->group('', ['filter' => 'api-auth'], static function ($routes) {
        // Master Data
    $routes->get('gedung', 'Api\DataController::getGedung');
    $routes->post('gedung/update', 'Api\DataController::updateGedung');
    $routes->post('gedung/pj', 'Api\DataController::setPjGedung');
    $routes->get('kamar', 'Api\DataController::getKamar');
    
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
    $routes->get('presensi/foto/(:segment)', 'Api\DataController::fotoWajah/$1');

    // Izin
    $routes->get('izin', 'Api\DataController::getIzin');
    $routes->post('izin', 'Api\DataController::addIzin');
    $routes->post('izin/status', 'Api\DataController::updateIzinStatus');

    // Pengaturan sesi & hari libur
    $routes->get('sesi', 'Api\PengaturanController::getSesi');
    $routes->post('sesi', 'Api\PengaturanController::saveSesi');
    $routes->get('libur', 'Api\PengaturanController::getLibur');
    $routes->post('libur', 'Api\PengaturanController::addLibur');
    $routes->post('libur/delete', 'Api\PengaturanController::deleteLibur');
    $routes->get('mode-uji', 'Api\PengaturanController::getModeUji');
    $routes->post('mode-uji', 'Api\PengaturanController::saveModeUji');

    });

    // Generic OPTIONS handler for CORS preflight
    $routes->options('(:any)', static function () {
        return response()->setStatusCode(200);
    });
});
