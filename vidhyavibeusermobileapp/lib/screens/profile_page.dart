import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/models.dart';
import '../services/api_client.dart';
import '../utils/delivery_modes.dart';
import '../widgets/auth_widgets.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  bool _loading = true;
  bool _savingProfile = false;
  bool _savingPassword = false;
  bool _editingProfile = false;
  bool _changingPassword = false;
  bool _addingReader = false;
  int? _editingReaderId;

  UserProfile? _user;
  List<ReaderChild> _readers = [];

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  final _readerNameController = TextEditingController();
  final _readerAgeController = TextEditingController();
  final _readerClassController = TextEditingController();
  final _readerSchoolController = TextEditingController();
  final _readerCityController = TextEditingController();
  String _readerDelivery = DeliveryModes.electronic;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _readerNameController.dispose();
    _readerAgeController.dispose();
    _readerClassController.dispose();
    _readerSchoolController.dispose();
    _readerCityController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final meRes = await ApiClient.getMe();
      final readersRes = await ApiClient.listReaders();
      if (!ApiClient.isOk(meRes)) {
        throw Exception('Failed to load profile');
      }
      final user = UserProfile.fromJson(ApiClient.decodeMap(meRes));
      final readers = ApiClient.isOk(readersRes)
          ? ApiClient.decodeList(readersRes)
              .whereType<Map>()
              .map((r) => ReaderChild.fromJson(Map<String, dynamic>.from(r)))
              .toList()
          : <ReaderChild>[];
      if (!mounted) return;
      setState(() {
        _user = user;
        _readers = readers;
        _nameController.text = user.name ?? '';
        _phoneController.text = user.phone ?? '';
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _saveProfile() async {
    if (_nameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Name is required')),
      );
      return;
    }
    setState(() => _savingProfile = true);
    try {
      final res = await ApiClient.updateMe({
        'name': _nameController.text.trim(),
        'phone': _phoneController.text.trim(),
      });
      if (!mounted) return;
      if (ApiClient.isOk(res)) {
        setState(() {
          _editingProfile = false;
          _user = UserProfile(
            id: _user!.id,
            email: _user!.email,
            name: _nameController.text.trim(),
            phone: _phoneController.text.trim(),
            deliveryAddress: _user!.deliveryAddress,
            isAdmin: _user!.isAdmin,
            guardians: _user!.guardians,
          );
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Profile updated!')),
        );
      } else {
        final data = ApiClient.decodeMap(res);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(apiErrorMessage(data, fallback: 'Update failed'))),
        );
      }
    } finally {
      if (mounted) setState(() => _savingProfile = false);
    }
  }

  Future<void> _savePassword() async {
    final current = _currentPasswordController.text;
    final next = _newPasswordController.text;
    final confirm = _confirmPasswordController.text;
    if (current.isEmpty || next.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter current and new password')),
      );
      return;
    }
    if (next.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('New password must be at least 6 characters')),
      );
      return;
    }
    if (next != confirm) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('New passwords do not match')),
      );
      return;
    }
    setState(() => _savingPassword = true);
    try {
      final res = await ApiClient.changePassword(
        currentPassword: current,
        newPassword: next,
      );
      if (!mounted) return;
      if (ApiClient.isOk(res)) {
        _currentPasswordController.clear();
        _newPasswordController.clear();
        _confirmPasswordController.clear();
        setState(() => _changingPassword = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Password updated')),
        );
      } else {
        final data = ApiClient.decodeMap(res);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(data, fallback: 'Password update failed'),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _savingPassword = false);
    }
  }

  void _startEditReader(ReaderChild r) {
    setState(() {
      _editingReaderId = r.id;
      _addingReader = false;
      _readerNameController.text = r.name;
      _readerAgeController.text = r.age?.toString() ?? '';
      _readerClassController.text = r.className ?? '';
      _readerSchoolController.text = r.schoolName ?? '';
      _readerCityController.text = r.schoolCity ?? '';
      _readerDelivery = r.deliveryMode == DeliveryModes.both
          ? DeliveryModes.both
          : DeliveryModes.electronic;
    });
  }

  void _startAddReader() {
    setState(() {
      _addingReader = true;
      _editingReaderId = null;
      _readerNameController.clear();
      _readerAgeController.clear();
      _readerClassController.clear();
      _readerSchoolController.clear();
      _readerCityController.clear();
      _readerDelivery = DeliveryModes.electronic;
    });
  }

  Map<String, dynamic> _readerPayload() {
    final payload = <String, dynamic>{
      'name': _readerNameController.text.trim(),
      'deliveryMode': _readerDelivery,
      'className': _readerClassController.text.trim().isEmpty
          ? null
          : _readerClassController.text.trim(),
      'schoolName': _readerSchoolController.text.trim().isEmpty
          ? null
          : _readerSchoolController.text.trim(),
      'schoolCity': _readerCityController.text.trim().isEmpty
          ? null
          : _readerCityController.text.trim(),
    };
    final age = int.tryParse(_readerAgeController.text.trim());
    if (age != null) payload['age'] = age;
    return payload;
  }

  Future<void> _saveReader() async {
    if (_readerNameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Child's name is required")),
      );
      return;
    }
    final payload = _readerPayload();
    try {
      if (_addingReader) {
        final res = await ApiClient.createReader(payload);
        if (!ApiClient.isOk(res)) {
          final data = ApiClient.decodeMap(res);
          throw Exception(apiErrorMessage(data, fallback: 'Failed to add'));
        }
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Child added')),
        );
      } else if (_editingReaderId != null) {
        final res = await ApiClient.updateReader(_editingReaderId!, payload);
        if (!ApiClient.isOk(res)) {
          final data = ApiClient.decodeMap(res);
          throw Exception(apiErrorMessage(data, fallback: 'Update failed'));
        }
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Child updated')),
        );
      }
      setState(() {
        _addingReader = false;
        _editingReaderId = null;
      });
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AuthTheme.buildAppBar('Profile', automaticallyImplyLeading: false),
      body: Container(
        decoration: AuthTheme.pageBackground,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                    children: [
                      _sectionCard(
                        title: 'Personal info',
                        trailing: IconButton(
                          icon: Icon(_editingProfile ? Icons.close : Icons.edit),
                          onPressed: () {
                            setState(() {
                              _editingProfile = !_editingProfile;
                              if (!_editingProfile && _user != null) {
                                _nameController.text = _user!.name ?? '';
                                _phoneController.text = _user!.phone ?? '';
                              }
                            });
                          },
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Text('Email: ${_user?.email ?? ''}',
                                style: const TextStyle(color: AuthTheme.mutedBrown)),
                            const SizedBox(height: 12),
                            if (_editingProfile) ...[
                              TextFormField(
                                controller: _nameController,
                                decoration: AuthTheme.fieldDecoration(label: 'Name'),
                              ),
                              const SizedBox(height: 12),
                              TextFormField(
                                controller: _phoneController,
                                keyboardType: TextInputType.phone,
                                decoration: AuthTheme.fieldDecoration(label: 'Phone'),
                              ),
                              const SizedBox(height: 12),
                              AuthPrimaryButton(
                                label: 'Save',
                                loading: _savingProfile,
                                onPressed: _saveProfile,
                              ),
                            ] else ...[
                              Text(
                                _user?.name ?? '—',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AuthTheme.brown,
                                  fontSize: 18,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _user?.phone?.isNotEmpty == true
                                    ? _user!.phone!
                                    : 'No phone',
                                style: const TextStyle(color: AuthTheme.mutedBrown),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      _sectionCard(
                        title: 'Password',
                        trailing: TextButton(
                          onPressed: () {
                            setState(() => _changingPassword = !_changingPassword);
                          },
                          child: Text(_changingPassword ? 'Cancel' : 'Change'),
                        ),
                        child: _changingPassword
                            ? Column(
                                children: [
                                  TextFormField(
                                    controller: _currentPasswordController,
                                    obscureText: true,
                                    decoration: AuthTheme.fieldDecoration(
                                      label: 'Current password',
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  TextFormField(
                                    controller: _newPasswordController,
                                    obscureText: true,
                                    decoration: AuthTheme.fieldDecoration(
                                      label: 'New password',
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  TextFormField(
                                    controller: _confirmPasswordController,
                                    obscureText: true,
                                    decoration: AuthTheme.fieldDecoration(
                                      label: 'Confirm new password',
                                    ),
                                  ),
                                  const SizedBox(height: 12),
                                  AuthPrimaryButton(
                                    label: 'Update password',
                                    loading: _savingPassword,
                                    onPressed: _savePassword,
                                  ),
                                ],
                              )
                            : const Text(
                                'Keep your account secure with a strong password.',
                                style: TextStyle(color: AuthTheme.mutedBrown),
                              ),
                      ),
                      const SizedBox(height: 14),
                      _sectionCard(
                        title: 'Children',
                        trailing: IconButton(
                          icon: const Icon(Icons.add),
                          onPressed: _startAddReader,
                        ),
                        child: Column(
                          children: [
                            if (_readers.isEmpty && !_addingReader)
                              const Text(
                                'No children added yet.',
                                style: TextStyle(color: AuthTheme.mutedBrown),
                              ),
                            ..._readers.map((r) {
                              final editing = _editingReaderId == r.id;
                              if (editing) return _readerForm(isNew: false);
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(
                                  r.name,
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                ),
                                subtitle: Text([
                                  if (r.age != null) 'Age ${r.age}',
                                  if (r.className != null) r.className!,
                                  if (r.schoolName != null) r.schoolName!,
                                ].join(' · ')),
                                trailing: IconButton(
                                  icon: const Icon(Icons.edit_outlined),
                                  onPressed: () => _startEditReader(r),
                                ),
                              );
                            }),
                            if (_addingReader) ...[
                              const Divider(),
                              _readerForm(isNew: true),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
      ),
    );
  }

  Widget _readerForm({required bool isNew}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          isNew ? 'Add child' : 'Edit child',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _readerNameController,
          decoration: AuthTheme.fieldDecoration(label: 'Name'),
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _readerAgeController,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          decoration: AuthTheme.fieldDecoration(label: 'Age'),
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _readerClassController,
          decoration: AuthTheme.fieldDecoration(label: 'Class'),
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _readerSchoolController,
          decoration: AuthTheme.fieldDecoration(label: 'School'),
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: _readerCityController,
          decoration: AuthTheme.fieldDecoration(label: 'City'),
        ),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          isExpanded: true,
          value: _readerDelivery,
          decoration: AuthTheme.fieldDecoration(label: 'Delivery'),
          items: DeliveryModes.dropdownItems
              .map(
                (o) => DropdownMenuItem(
                  value: o.value,
                  child: Text(
                    o.label,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              )
              .toList(),
          onChanged: (v) {
            if (v != null) setState(() => _readerDelivery = v);
          },
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            TextButton(
              onPressed: () {
                setState(() {
                  _addingReader = false;
                  _editingReaderId = null;
                });
              },
              child: const Text('Cancel'),
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: _saveReader,
              style: AuthTheme.primaryButtonStyle,
              child: Text(isNew ? 'Add' : 'Save'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _sectionCard({
    required String title,
    required Widget child,
    Widget? trailing,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.85),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AuthTheme.brown.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AuthTheme.brown,
                    fontSize: 16,
                  ),
                ),
              ),
              if (trailing != null) trailing,
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
