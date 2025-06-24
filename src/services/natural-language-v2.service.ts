export interface ConversionResult {
  type: 'currency' | 'temperature' | 'distance' | 'weight' | 'volume';
  from: string;
  to: string;
  fromValue: number;
  toValue: number;
  formatted: string;
}

export interface CalculationResult {
  expression: string;
  result: number;
  formatted: string;
  explanation?: string;
}

export class NaturalLanguageV2Service {
  // Taux de change (à mettre à jour via API plus tard)
  private currencyRates = {
    'EUR_XOF': 655.957,  // 1 EUR = 655.957 CFA
    'USD_XOF': 600,      // Approximatif
    'EUR_USD': 1.09,
  };

  async detectAndProcessConversion(text: string): Promise<ConversionResult | null> {
    // Conversions de devises EUR vers CFA
    const eurToCfaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:euros?|eur|€)\s*(?:en|to|vers?)\s*(?:cfa|fcfa|xof)/i);
    if (eurToCfaMatch && eurToCfaMatch[1]) {
      const amount = parseFloat(eurToCfaMatch[1]);
      const result = amount * this.currencyRates.EUR_XOF;
      return {
        type: 'currency',
        from: 'EUR',
        to: 'XOF',
        fromValue: amount,
        toValue: result,
        formatted: `${amount} € = ${result.toLocaleString('fr-FR')} CFA`
      };
    }

    // Conversions de devises USD vers CFA
    const usdToCfaMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:dollars?|usd|\$)\s*(?:en|to|vers?)\s*(?:cfa|fcfa|xof)/i);
    if (usdToCfaMatch && usdToCfaMatch[1]) {
      const amount = parseFloat(usdToCfaMatch[1]);
      const result = amount * this.currencyRates.USD_XOF;
      return {
        type: 'currency',
        from: 'USD',
        to: 'XOF',
        fromValue: amount,
        toValue: result,
        formatted: `${amount} $ = ${result.toLocaleString('fr-FR')} CFA`
      };
    }

    // Conversions de devises CFA vers EUR
    const cfaToEurMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:cfa|fcfa|xof)\s*(?:en|to|vers?)\s*(?:euros?|eur|€)/i);
    if (cfaToEurMatch && cfaToEurMatch[1]) {
      const amount = parseFloat(cfaToEurMatch[1]);
      const result = amount / this.currencyRates.EUR_XOF;
      return {
        type: 'currency',
        from: 'XOF',
        to: 'EUR',
        fromValue: amount,
        toValue: result,
        formatted: `${amount.toLocaleString('fr-FR')} CFA = ${result.toFixed(2)} €`
      };
    }

    // Conversions de température
    const tempMatch = text.match(/(\d+(?:\.\d+)?)\s*°?\s*([cf])\s*(?:en|to|vers?)\s*°?\s*([cf])/i);
    if (tempMatch && tempMatch[1] && tempMatch[2] && tempMatch[3]) {
      const value = parseFloat(tempMatch[1]);
      const fromUnit = tempMatch[2].toUpperCase();
      const toUnit = tempMatch[3].toUpperCase();

      let result: number;
      if (fromUnit === 'C' && toUnit === 'F') {
        result = (value * 9/5) + 32;
      } else if (fromUnit === 'F' && toUnit === 'C') {
        result = (value - 32) * 5/9;
      } else {
        result = value;
      }

      return {
        type: 'temperature',
        from: fromUnit,
        to: toUnit,
        fromValue: value,
        toValue: result,
        formatted: `${value}°${fromUnit} = ${result.toFixed(1)}°${toUnit}`
      };
    }

    // Conversions de distance
    const kmToMilesMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:km|kilomètres?)\s*(?:en|to|vers?)\s*(?:miles?)/i);
    if (kmToMilesMatch && kmToMilesMatch[1]) {
      const value = parseFloat(kmToMilesMatch[1]);
      const miles = value * 0.621371;
      return {
        type: 'distance',
        from: 'km',
        to: 'miles',
        fromValue: value,
        toValue: miles,
        formatted: `${value} km = ${miles.toFixed(2)} miles`
      };
    }

    const milesToKmMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:miles?)\s*(?:en|to|vers?)\s*(?:km|kilomètres?)/i);
    if (milesToKmMatch && milesToKmMatch[1]) {
      const value = parseFloat(milesToKmMatch[1]);
      const km = value * 1.60934;
      return {
        type: 'distance',
        from: 'miles',
        to: 'km',
        fromValue: value,
        toValue: km,
        formatted: `${value} miles = ${km.toFixed(2)} km`
      };
    }

    return null;
  }

  async detectAndProcessCalculation(text: string): Promise<CalculationResult | null> {
    // Partage entre personnes
    const shareMatch = text.match(/partage\s+(\d+(?:\.\d+)?)\s*(?:cfa|fcfa|€|euros?)?\s+entre\s+(\d+)\s*(?:personnes?)?/i);
    if (shareMatch && shareMatch[1] && shareMatch[2]) {
      const amount = parseFloat(shareMatch[1]);
      const people = parseInt(shareMatch[2]);
      const perPerson = amount / people;
      
      return {
        expression: `${amount} ÷ ${people}`,
        result: perPerson,
        formatted: `${perPerson.toLocaleString('fr-FR')} CFA par personne`,
        explanation: `${amount.toLocaleString('fr-FR')} CFA partagé entre ${people} personnes`
      };
    }

    // Calcul de pourcentage
    const percentMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*de\s*(\d+(?:\.\d+)?)/i);
    if (percentMatch && percentMatch[1] && percentMatch[2]) {
      const percent = parseFloat(percentMatch[1]);
      const amount = parseFloat(percentMatch[2]);
      const result = (percent / 100) * amount;
      
      return {
        expression: `${percent}% × ${amount}`,
        result: result,
        formatted: result.toLocaleString('fr-FR'),
        explanation: `${percent}% de ${amount.toLocaleString('fr-FR')}`
      };
    }

    // Calcul TVA (18% en Côte d'Ivoire)
    const tvaMatch = text.match(/calcule?\s+(?:la\s+)?tva\s+(?:sur|de)\s+(\d+(?:\.\d+)?)/i);
    if (tvaMatch && tvaMatch[1]) {
      const amount = parseFloat(tvaMatch[1]);
      const tva = amount * 0.18;
      const total = amount + tva;
      
      return {
        expression: `${amount} + 18%`,
        result: total,
        formatted: `HT: ${amount.toLocaleString('fr-FR')} CFA\nTVA (18%): ${tva.toLocaleString('fr-FR')} CFA\nTTC: ${total.toLocaleString('fr-FR')} CFA`,
        explanation: 'Calcul avec TVA à 18%'
      };
    }

    // Opérations arithmétiques simples
    const addMatch = text.match(/(\d+(?:\.\d+)?)\s*\+\s*(\d+(?:\.\d+)?)/);
    if (addMatch && addMatch[1] && addMatch[2]) {
      const a = parseFloat(addMatch[1]);
      const b = parseFloat(addMatch[2]);
      return {
        expression: `${a} + ${b}`,
        result: a + b,
        formatted: (a + b).toLocaleString('fr-FR')
      };
    }

    const subMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    if (subMatch && subMatch[1] && subMatch[2]) {
      const a = parseFloat(subMatch[1]);
      const b = parseFloat(subMatch[2]);
      return {
        expression: `${a} - ${b}`,
        result: a - b,
        formatted: (a - b).toLocaleString('fr-FR')
      };
    }

    const mulMatch = text.match(/(\d+(?:\.\d+)?)\s*[x*]\s*(\d+(?:\.\d+)?)/);
    if (mulMatch && mulMatch[1] && mulMatch[2]) {
      const a = parseFloat(mulMatch[1]);
      const b = parseFloat(mulMatch[2]);
      return {
        expression: `${a} × ${b}`,
        result: a * b,
        formatted: (a * b).toLocaleString('fr-FR')
      };
    }

    const divMatch = text.match(/(\d+(?:\.\d+)?)\s*[/÷]\s*(\d+(?:\.\d+)?)/);
    if (divMatch && divMatch[1] && divMatch[2]) {
      const a = parseFloat(divMatch[1]);
      const b = parseFloat(divMatch[2]);
      if (b === 0) return null;
      return {
        expression: `${a} ÷ ${b}`,
        result: a / b,
        formatted: (a / b).toLocaleString('fr-FR')
      };
    }

    return null;
  }

  // Détection de demande de pile ou face
  detectCoinFlip(text: string): boolean {
    return /pile\s+ou\s+face|lance\s+une?\s+pièce|flip\s+coin/i.test(text);
  }

  // Lancer une pièce
  flipCoin(): string {
    const result = Math.random() < 0.5 ? 'Pile' : 'Face';
    const emoji = result === 'Pile' ? '🪙' : '💰';
    return `${emoji} **${result}!**`;
  }

  // Détection de demande de nombre aléatoire
  detectRandomNumber(text: string): { min: number; max: number } | null {
    const match = text.match(/(?:choisis?|donne|génère)\s+(?:un\s+)?nombre\s+entre\s+(\d+)\s+et\s+(\d+)/i);
    if (match && match[1] && match[2]) {
      return {
        min: parseInt(match[1]),
        max: parseInt(match[2])
      };
    }
    
    return null;
  }

  // Générer un nombre aléatoire
  generateRandomNumber(min: number, max: number): string {
    const num = Math.floor(Math.random() * (max - min + 1)) + min;
    return `🎲 J'ai choisi le nombre : **${num}**`;
  }

  // Détection de choix multiples
  detectRandomChoice(text: string): string[] | null {
    const match = text.match(/choisis?\s+entre\s+(.+)/i);
    if (match && match[1]) {
      const choices = match[1]
        .split(/[,،]|\s+ou\s+|\s+et\s+/i)
        .map(choice => choice.trim())
        .filter(choice => choice.length > 0);
      
      if (choices.length >= 2) {
        return choices;
      }
    }
    
    return null;
  }

  // Faire un choix aléatoire
  makeRandomChoice(choices: string[]): string {
    const choice = choices[Math.floor(Math.random() * choices.length)];
    return `🎯 Mon choix : **${choice}**`;
  }

  // Générer un mot de passe
  generatePassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const charset = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    
    return password;
  }

  // Détecter demande de mot de passe
  detectPasswordRequest(text: string): number | null {
    const match = text.match(/(?:génère|crée|donne)(?:-moi)?\s+(?:un\s+)?mot de passe\s*(?:de\s+(\d+)\s+caractères)?/i);
    if (match) {
      return match[1] ? parseInt(match[1]) : 12;
    }
    
    return null;
  }
}

export const naturalLanguageV2Service = new NaturalLanguageV2Service();