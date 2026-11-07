<?php

namespace App\Controllers\Api;

use App\Controllers\BaseController;
use CodeIgniter\API\ResponseTrait;

class AuthController extends BaseController
{
    use ResponseTrait;

    protected $db;

    public function __construct()
    {
        $this->db = \Config\Database::connect();
    }

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
            ->select('u.NIM, u.Nama, u.Email, u.No_HP, u.Asal, u.Role, u.Nomor_kamar, u.Status_aktif, u.Password, u.Foto_profil, u.created_at, k.Id_Gedung, g.Nama as nama_gedung')
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

        if (!password_verify($password, $user['Password'])) {
            $this->db->table('user')->where('NIM', $nim)->update(['Password' => password_hash($password, PASSWORD_BCRYPT)]);
        }

        $roleMapped = strtolower($user['Role']);
        if ($roleMapped === 'mahasiswa') {
            $roleMapped = 'penghuni';
        }

        $responseUser = [
            'nim'        => $user['NIM'],
            'nama'       => $user['Nama'],
            'email'      => $user['Email'] ?? '',
            'noHp'       => $user['No_HP'] ?? '',
            'asal'       => $user['Asal'] ?? '',
            'role'       => $roleMapped,
            'nomorKamar' => $user['Nomor_kamar'] ?? '',
            'idGedung'   => $user['Id_Gedung'] !== null ? (int) $user['Id_Gedung'] : null,
            'namaGedung' => $user['nama_gedung'] ?? '',
            'tanggalMasuk' => $user['created_at'] ? substr($user['created_at'], 0, 10) : null,
            'fotoProfil' => $user['Foto_profil'] ?? '',
        ];

        $tokenPayload = base64_encode(json_encode(['nim' => $user['NIM'], 'role' => $roleMapped, 'exp' => time() + 86400 * 7]));
        $encodedToken = rtrim(strtr($tokenPayload, '+/', '-_'), '=');
        $token = $encodedToken . '.' . hash_hmac('sha256', $encodedToken, env('encryption.key', 'sip-asrama-v1'));

        return $this->respond([
            'status'  => 'success',
            'message' => 'Login berhasil',
            'token'   => $token,
            'data'    => $responseUser
        ]);
    }

    public function changePassword()
    {
        $input = $this->request->getJSON(true) ?? [];
        $nim = trim($input['nim'] ?? '');
        $old = (string) ($input['passwordLama'] ?? '');
        $new = (string) ($input['passwordBaru'] ?? '');
        if ($new === '' || strlen($new) < 8) return $this->fail('Password baru minimal 8 karakter.', 400);
        if ($nim !== $this->tokenUser()['nim']) return $this->failForbidden('Akses akun tidak valid.');
        $user = $this->db->table('user')->where('NIM', $nim)->get()->getRowArray();
        if (!$user || !password_verify($old, $user['Password'])) return $this->fail('Password lama salah.', 401);
        $this->db->table('user')->where('NIM', $nim)->update(['Password' => password_hash($new, PASSWORD_BCRYPT), 'updated_at' => date('Y-m-d H:i:s')]);
        return $this->respond(['status' => 'success', 'message' => 'Password berhasil diubah.']);
    }

    public function profilePhoto()
    {
        $input = $this->request->getJSON(true) ?? [];
        $nim = trim($input['nim'] ?? '');
        $photo = (string) ($input['fotoProfil'] ?? '');
        if ($nim !== $this->tokenUser()['nim']) return $this->failForbidden('Akses akun tidak valid.');
        if (!preg_match('/^data:image\/(jpeg|png|webp);base64,/', $photo)) return $this->fail('Format foto tidak didukung.', 400);
        if (strlen($photo) > 2 * 1024 * 1024) return $this->fail('Ukuran foto maksimal 2 MB.', 400);
        $this->db->table('user')->where('NIM', $nim)->update(['Foto_profil' => $photo, 'updated_at' => date('Y-m-d H:i:s')]);
        return $this->respond(['status' => 'success', 'message' => 'Foto profil berhasil diperbarui.']);
    }

    public function profile()
    {
        $input = $this->request->getJSON(true) ?? [];
        $token = $this->tokenUser();
        $nim = trim($input['nim'] ?? '');
        $nama = trim($input['nama'] ?? '');
        $email = trim($input['email'] ?? '');
        $noHp = trim($input['noHp'] ?? '');
        $asal = trim($input['asal'] ?? '');
        if ($nim !== ($token['nim'] ?? '')) return $this->failForbidden('Akses akun tidak valid.');
        if ($nama === '') return $this->fail('Nama lengkap wajib diisi.', 400);
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) return $this->fail('Format email tidak valid.', 400);
        $this->db->table('user')->where('NIM', $nim)->update([
            'Nama' => $nama,
            'Email' => $email ?: null,
            'No_HP' => $noHp ?: null,
            'Asal' => $asal ?: null,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        return $this->respond(['status' => 'success', 'message' => 'Detail profil berhasil diperbarui.']);
    }

    private function tokenUser(): array
    {
        $header = $this->request->getHeaderLine('Authorization');
        [$encoded, $signature] = array_pad(explode('.', preg_replace('/^Bearer\s+/i', '', $header), 2), 2, '');
        $payload = base64_decode(strtr($encoded, '-_', '+/'));
        $data = json_decode($payload ?: '', true);
        $expected = hash_hmac('sha256', $encoded, env('encryption.key', 'sip-asrama-v1'));
        if (!$data || !hash_equals($expected, $signature) || ($data['exp'] ?? 0) < time()) return [];
        return $data;
    }
}
