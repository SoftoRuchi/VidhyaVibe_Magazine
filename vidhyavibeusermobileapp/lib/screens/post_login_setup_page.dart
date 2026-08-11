import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'main_shell.dart';
import '../models/models.dart';
import '../services/api_client.dart';
import '../services/auth_storage.dart';
import '../services/viewing_context.dart';
import '../utils/delivery_modes.dart';
import '../widgets/auth_widgets.dart';

/// Mirrors web PostLoginChildSetupModal:
/// - no children → family setup
/// - has children → "Who is this login for?" (parent vs child)
class PostLoginSetupPage extends StatefulWidget {
  const PostLoginSetupPage({super.key});

  @override
  State<PostLoginSetupPage> createState() => _PostLoginSetupPageState();
}

class _PostLoginSetupPageState extends State<PostLoginSetupPage> {
  final _parentFormKey = GlobalKey<FormState>();
  final _childFormKey = GlobalKey<FormState>();

  final _parentNameController = TextEditingController();
  final _parentPhoneController = TextEditingController();
  final _parentAddressController = TextEditingController();

  final _childNameController = TextEditingController();
  final _childAgeController = TextEditingController();
  final _childClassController = TextEditingController();
  final _childSchoolController = TextEditingController();
  final _childCityController = TextEditingController();

  String _deliveryMode = DeliveryModes.electronic;
  bool _loading = true;
  bool _savingParent = false;
  bool _addingChild = false;

  UserProfile? _me;
  List<ReaderChild> _readers = [];
  String _step = 'chooser'; // 'chooser' | 'setup'

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _parentNameController.dispose();
    _parentPhoneController.dispose();
    _parentAddressController.dispose();
    _childNameController.dispose();
    _childAgeController.dispose();
    _childClassController.dispose();
    _childSchoolController.dispose();
    _childCityController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final meRes = await ApiClient.getMe();
      final readersRes = await ApiClient.listReaders();

      if (!ApiClient.isOk(meRes)) {
        await _finishAsParent();
        return;
      }

      final me = UserProfile.fromJson(ApiClient.decodeMap(meRes));
      if (me.isAdmin) {
        await AuthStorage.setShowPostLoginSetup(false);
        await ViewingContext.setParentAudience();
        if (!mounted) return;
        _goHome();
        return;
      }

      final readers = ApiClient.decodeList(readersRes)
          .whereType<Map>()
          .map((r) => ReaderChild.fromJson(Map<String, dynamic>.from(r)))
          .toList();

      _parentNameController.text =
          me.name?.trim().isNotEmpty == true
              ? me.name!.trim()
              : (me.guardians.isNotEmpty ? me.guardians.first.name : '');
      _parentPhoneController.text =
          me.phone ??
          (me.guardians.isNotEmpty ? (me.guardians.first.phone ?? '') : '');
      _parentAddressController.text = me.deliveryAddress ?? '';

      setState(() {
        _me = me;
        _readers = readers;
        _step = readers.isNotEmpty ? 'chooser' : 'setup';
        _loading = false;
      });
    } catch (_) {
      await _finishAsParent();
    }
  }

  Future<void> _finishAsParent() async {
    await ViewingContext.setParentAudience();
    await AuthStorage.setShowPostLoginSetup(false);
    if (!mounted) return;
    _goHome();
  }

  void _goHome() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const MainShell()),
      (_) => false,
    );
  }

  Future<void> _chooseParent() async {
    await ViewingContext.setParentAudience();
    await AuthStorage.setShowPostLoginSetup(false);
    if (!mounted) return;
    _goHome();
  }

  Future<void> _chooseChild(ReaderChild reader) async {
    await ViewingContext.setChildAudience(
      readerId: reader.id,
      readerName: reader.name,
    );
    await AuthStorage.setShowPostLoginSetup(false);
    if (!mounted) return;
    _goHome();
  }

  Future<void> _saveParent() async {
    if (!_parentFormKey.currentState!.validate()) return;
    setState(() => _savingParent = true);
    try {
      final res = await ApiClient.updateMe({
        'name': _parentNameController.text.trim(),
        'phone': _parentPhoneController.text.trim(),
        'deliveryAddress': _parentAddressController.text.trim(),
      });
      if (!mounted) return;
      if (ApiClient.isOk(res)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Your details saved')),
        );
        setState(() {
          _me = UserProfile(
            id: _me!.id,
            email: _me!.email,
            name: _parentNameController.text.trim(),
            phone: _parentPhoneController.text.trim(),
            deliveryAddress: _parentAddressController.text.trim(),
            isAdmin: _me!.isAdmin,
            guardians: _me!.guardians,
          );
        });
      } else {
        final data = ApiClient.decodeMap(res);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(data, fallback: 'Could not save profile'),
            ),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not save profile')),
      );
    } finally {
      if (mounted) setState(() => _savingParent = false);
    }
  }

  Future<void> _addChild() async {
    if (!_childFormKey.currentState!.validate()) return;
    setState(() => _addingChild = true);
    try {
      final ageText = _childAgeController.text.trim();
      final payload = <String, dynamic>{
        'name': _childNameController.text.trim(),
        'deliveryMode': _deliveryMode,
      };
      if (ageText.isNotEmpty) {
        payload['age'] = int.tryParse(ageText);
      }
      final className = _childClassController.text.trim();
      final schoolName = _childSchoolController.text.trim();
      final schoolCity = _childCityController.text.trim();
      if (className.isNotEmpty) payload['className'] = className;
      if (schoolName.isNotEmpty) payload['schoolName'] = schoolName;
      if (schoolCity.isNotEmpty) payload['schoolCity'] = schoolCity;

      final res = await ApiClient.createReader(payload);
      if (!mounted) return;
      if (ApiClient.isOk(res)) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Child added')),
        );
        _childFormKey.currentState!.reset();
        _childNameController.clear();
        _childAgeController.clear();
        _childClassController.clear();
        _childSchoolController.clear();
        _childCityController.clear();
        setState(() => _deliveryMode = DeliveryModes.electronic);

        final readersRes = await ApiClient.listReaders();
        final readers = ApiClient.decodeList(readersRes)
            .whereType<Map>()
            .map((r) => ReaderChild.fromJson(Map<String, dynamic>.from(r)))
            .toList();
        setState(() {
          _readers = readers;
          if (readers.isNotEmpty) _step = 'chooser';
        });
      } else {
        final data = ApiClient.decodeMap(res);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              apiErrorMessage(data, fallback: 'Could not add child'),
            ),
          ),
        );
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not add child')),
      );
    } finally {
      if (mounted) setState(() => _addingChild = false);
    }
  }

  Future<void> _skipOrDone() async {
    await ViewingContext.setParentAudience();
    await AuthStorage.setShowPostLoginSetup(false);
    if (!mounted) return;
    _goHome();
  }

  @override
  Widget build(BuildContext context) {
    return AuthPageShell(
      brandTitle: false,
      child: AuthCard(
        child: _loading
            ? const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            : (_step == 'chooser' ? _buildChooser() : _buildSetup()),
      ),
    );
  }

  Widget _buildChooser() {
    final parentName = _me?.displayName ?? 'Parent';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AuthHeading(
          title: 'Who is this login for?',
          subtitle: 'Select who is using the app right now.',
        ),
        const SizedBox(height: 24),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          alignment: WrapAlignment.center,
          children: [
            _AudienceAvatar(
              label: parentName,
              role: 'Parent',
              color: const Color(0xFF2563EB),
              onTap: _chooseParent,
            ),
            ..._readers.map(
              (r) => _AudienceAvatar(
                label: r.name,
                role: 'Child',
                color: const Color(0xFF16A34A),
                onTap: () => _chooseChild(r),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        OutlinedButton(
          onPressed: _chooseParent,
          style: OutlinedButton.styleFrom(
            foregroundColor: AuthTheme.brown,
            side: BorderSide(color: AuthTheme.brown.withValues(alpha: 0.35)),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          child: const Text('Continue as parent'),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: () => setState(() => _step = 'setup'),
          child: const Text(
            'Add another child',
            style: TextStyle(
              color: AuthTheme.green,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSetup() {
    return Form(
      key: _parentFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const AuthHeading(
            title: 'Welcome — set up your family',
            subtitle:
                'Confirm guardian details, then add one or more children. You can add more later from Profile.',
          ),
          const SizedBox(height: 20),
          Text(
            'Guardian / parent',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: AuthTheme.brown.withValues(alpha: 0.9),
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _parentNameController,
            textCapitalization: TextCapitalization.words,
            decoration: AuthTheme.fieldDecoration(label: 'Your full name'),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Required' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _parentPhoneController,
            keyboardType: TextInputType.phone,
            decoration: AuthTheme.fieldDecoration(label: 'Phone (optional)'),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _parentAddressController,
            minLines: 2,
            maxLines: 3,
            decoration: AuthTheme.fieldDecoration(label: 'Delivery address'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _savingParent ? null : _saveParent,
            child: _savingParent
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Save guardian details'),
          ),
          const SizedBox(height: 24),
          Text(
            'Children',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: AuthTheme.brown.withValues(alpha: 0.9),
            ),
          ),
          if (_readers.isNotEmpty) ...[
            const SizedBox(height: 10),
            ..._readers.map(
              (r) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: const Color(0xFF16A34A),
                  child: Text(
                    r.name.isNotEmpty ? r.name[0].toUpperCase() : 'C',
                    style: const TextStyle(color: Colors.white),
                  ),
                ),
                title: Text(r.name),
                subtitle: r.age != null ? Text('Age ${r.age}') : null,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Form(
            key: _childFormKey,
            child: Column(
              children: [
                TextFormField(
                  controller: _childNameController,
                  textCapitalization: TextCapitalization.words,
                  decoration: AuthTheme.fieldDecoration(
                    label: "Child's name",
                  ),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? "Please enter the child's name"
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _childAgeController,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: AuthTheme.fieldDecoration(
                    label: 'Age (optional)',
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _childClassController,
                  decoration: AuthTheme.fieldDecoration(
                    label: 'Class (optional)',
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _childSchoolController,
                  decoration: AuthTheme.fieldDecoration(
                    label: 'School (optional)',
                  ),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _childCityController,
                  decoration: AuthTheme.fieldDecoration(
                    label: 'City (optional)',
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _deliveryMode,
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
                    if (v != null) setState(() => _deliveryMode = v);
                  },
                ),
                const SizedBox(height: 16),
                AuthPrimaryButton(
                  label: 'Add child',
                  loading: _addingChild,
                  onPressed: _addChild,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: TextButton(
                  onPressed: _skipOrDone,
                  child: const Text('Skip for now'),
                ),
              ),
              Expanded(
                child: AuthPrimaryButton(
                  label: 'Done',
                  loading: false,
                  onPressed: _skipOrDone,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AudienceAvatar extends StatelessWidget {
  const _AudienceAvatar({
    required this.label,
    required this.role,
    required this.color,
    required this.onTap,
  });

  final String label;
  final String role;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final initial = label.trim().isNotEmpty ? label.trim()[0].toUpperCase() : '?';
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        width: 100,
        child: Column(
          children: [
            CircleAvatar(
              radius: 36,
              backgroundColor: color,
              child: Text(
                initial,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 28,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AuthTheme.brown,
              ),
            ),
            Text(
              role,
              style: const TextStyle(
                color: AuthTheme.mutedBrown,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
