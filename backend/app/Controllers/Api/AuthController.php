<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\API\ResponseTrait;

class AuthController extends BaseController
{
    use ResponseTrait;

    public function login()
    {
        $json = $this->request->getJSON(true) ?? $this->request->getPost();
        $nim = trim($json['nim'] ?? '');
        $password = trim($json['password'] ?? '');

        if (empty($nim) || empty($password)) {
            return $this->fail('NIM dan Password wajib diisi', 400);
        }

        $db = \Config\Database::connect();
        $builder = $db->table('user u')
            ->select('u.NIM, u.Nama, u.Email, u.Role, u.Nomor_kamar, u.Status_aktif, u.Password, k.Id_Gedung, g.Nama as nama_gedung')
            ->join('kamar k', 'k.Nomor_kamar = u.Nomor_kamar', 'left')
            ->join('gedung g', 'g.Id_Gedung = k.Id_Gedung', 'left')
            ->where('u.NIM', $nim);
        
        $user = $builder->get()->getRowArray();

        if (!$user) {
            return $this->failNotFound('User dengan NIM tersebut tidak ditemukan.');
        }

        // Verify password: bcrypt or plain text match
        $passwordValid = password_verify($password, $user['Password']) || ($password === $user['Password']);
        if (!$passwordValid) {
            return $this->fail('Password yang Anda masukkan salah.', 401);
        }

        if (strtolower($user['Status_aktif']) === 'nonaktif') {
            return $this->fail('Akun Anda dinonaktifkan. Silakan hubungi pengurus.', 403);
        }

        $roleMapped = strtolower($user['Role']);
        if ($roleMapped === 'mahasiswa') {
            $roleMapped = 'penghuni';
        }

        $responseUser = [
            'nim'        => $user['NIM'],
            'nama'       => $user['Nama'],
            'email'      => $user['Email'] ?? '',
            'role'       => $roleMapped,
            'nomorKamar' => $user['Nomor_kamar'] ?? '',
            'namaGedung' => $user['nama_gedung'] ?? '',
        ];

        return $this->respond([
            'status'  => 'success',
            'message' => 'Login berhasil',
            'data'    => $responseUser
        ]);
    }
}
