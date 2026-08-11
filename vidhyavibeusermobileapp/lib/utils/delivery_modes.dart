/// Delivery mode API values + user-facing labels.
class DeliveryModes {
  DeliveryModes._();

  static const electronic = 'ELECTRONIC';
  static const both = 'BOTH';

  static const labelElectronic = 'E-magazine';
  static const labelBoth = 'Both (e-magazine + physical)';

  static String label(String? mode) {
    switch (mode) {
      case both:
        return labelBoth;
      case electronic:
      default:
        return labelElectronic;
    }
  }

  static const dropdownItems = <DropdownOption>[
    DropdownOption(value: electronic, label: labelElectronic),
    DropdownOption(value: both, label: labelBoth),
  ];
}

class DropdownOption {
  const DropdownOption({required this.value, required this.label});
  final String value;
  final String label;
}
