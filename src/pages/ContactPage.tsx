import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone, Search } from 'lucide-react';
import ClientLayout from '@/components/client/ClientLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchPublicMenu } from '@/lib/menu-api';

export default function ContactPage() {
  const [restaurantName, setRestaurantName] = useState('Pasta House');
  const [addressLine, setAddressLine] = useState('Bruxelles');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadContactData() {
      try {
        const data = await fetchPublicMenu();
        if (!isMounted) return;

        if (data.siteSettings?.restaurantName) {
          setRestaurantName(data.siteSettings.restaurantName);
        }

        const addressParts = [
          data.siteSettings?.addressLine1,
          data.siteSettings?.postalCode,
          data.siteSettings?.city,
        ].filter(Boolean);

        if (addressParts.length > 0) {
          setAddressLine(addressParts.join(', '));
        }

        if (data.siteSettings?.phone) {
          setPhone(data.siteSettings.phone);
        }

        if (data.siteSettings?.email) {
          setEmail(data.siteSettings.email);
        }
      } catch (error) {
        console.error('Failed to load contact data:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadContactData();

    return () => {
      isMounted = false;
    };
  }, []);

  const phoneHref = useMemo(() => {
    if (!phone) return '';
    return `tel:${phone.replace(/\s+/g, '')}`;
  }, [phone]);

  const emailHref = useMemo(() => {
    if (!email) return '';
    return `mailto:${email}`;
  }, [email]);

  async function handleRecoverTracking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = recoveryEmail.trim();

    if (!normalizedEmail) {
      setRecoveryError('Veuillez entrer votre adresse email.');
      setRecoveryMessage('');
      return;
    }

    try {
      setRecoveryLoading(true);
      setRecoveryError('');
      setRecoveryMessage('');

      const response = await fetch('/api/public/orders/recover-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.ok) {
        if (response.status === 429) {
          throw new Error(
            json?.message ||
              'Trop de tentatives ont déjà été effectuées pour retrouver une commande. Merci de nous contacter directement.',
          );
        }

        if (json?.errors?.fieldErrors?.email?.[0]) {
          throw new Error(json.errors.fieldErrors.email[0]);
        }

        throw new Error(json?.message || 'Impossible d’envoyer le lien de suivi.');
      }

      setRecoveryMessage(
        json.message ||
          'Si une commande récente correspond à cette adresse, un email de suivi vient d’être envoyé. Pensez à vérifier aussi vos spams, promotions et courriers indésirables.',
      );
      setRecoveryEmail('');
    } catch (error) {
      console.error('Recover tracking request failed:', error);
      setRecoveryError(
        error instanceof Error
          ? error.message
          : 'Impossible d’envoyer le lien de suivi.',
      );
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <ClientLayout>
      <div className="container max-w-5xl py-10 md:py-14">
        <div className="max-w-2xl reveal">
          <p className="eyebrow">Contact</p>
          <h1 className="h-display mt-2 text-4xl md:text-5xl text-foreground">
            Nous <span className="h-display-italic text-primary">contacter.</span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Une question sur votre commande, un horaire ou un retrait sur place ? Retrouvez ici
            les coordonnées de {restaurantName} et le formulaire pour récupérer votre lien de suivi.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="card-elevated p-5 reveal reveal-delay-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-primary">
              <Phone className="h-4 w-4" strokeWidth={1.7} />
            </div>
            <h2 className="mt-4 font-display text-2xl text-foreground">Téléphone</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Contactez-nous rapidement si vous avez une question sur votre commande.
            </p>
            <div className="mt-4">
              {phoneHref ? (
                <a
                  href={phoneHref}
                  className="link-underline text-sm font-medium text-foreground"
                >
                  {phone}
                </a>
              ) : (
                <p className="text-sm font-medium text-foreground">
                  {phone || 'Non renseigné'}
                </p>
              )}
            </div>
          </div>

          <div className="card-elevated p-5 reveal reveal-delay-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-primary">
              <Mail className="h-4 w-4" strokeWidth={1.7} />
            </div>
            <h2 className="mt-4 font-display text-2xl text-foreground">Email</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Écrivez-nous si votre demande n’est pas urgente.
            </p>
            <div className="mt-4">
              {emailHref ? (
                <a
                  href={emailHref}
                  className="link-underline break-all text-sm font-medium text-foreground"
                >
                  {email}
                </a>
              ) : (
                <p className="text-sm font-medium text-foreground">
                  {email || 'Non renseigné'}
                </p>
              )}
            </div>
          </div>

          <div className="card-elevated p-5 reveal reveal-delay-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-primary">
              <MapPin className="h-4 w-4" strokeWidth={1.7} />
            </div>
            <h2 className="mt-4 font-display text-2xl text-foreground">Adresse</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Utile si vous avez choisi le retrait sur place.
            </p>
            <p className="mt-4 text-sm font-medium text-foreground">
              {addressLine}
            </p>
          </div>
        </div>

        <div className="mt-8 card-elevated p-6 md:p-7 reveal reveal-delay-2">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-primary">
              <Search className="h-4 w-4" strokeWidth={1.7} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Suivi de commande</p>
              <h2 className="mt-2 font-display text-3xl text-foreground">
                Retrouver <span className="h-display-italic text-primary">ma commande.</span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Vous n’avez plus votre lien de suivi ? Entrez votre adresse email ci-dessous.
                Si une commande récente correspond à cette adresse, nous vous renverrons un email
                avec votre lien de suivi.
              </p>

              <form onSubmit={handleRecoverTracking} className="mt-5 space-y-3">
                <Input
                  type="email"
                  value={recoveryEmail}
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                  placeholder="Votre adresse email"
                  autoComplete="email"
                  disabled={recoveryLoading}
                  className="h-11 rounded-[calc(var(--radius)-2px)] border-border bg-card placeholder:text-muted-foreground/60"
                />

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" disabled={recoveryLoading} className="h-11 px-6 font-semibold">
                    {recoveryLoading ? 'Envoi en cours…' : 'Recevoir mon lien de suivi'}
                  </Button>

                  <Button asChild type="button" variant="outline" className="h-11 px-6 bg-card border-border">
                    <Link to="/commander">Commander maintenant</Link>
                  </Button>
                </div>
              </form>

              {recoveryMessage && (
                <div className="mt-4 rounded-[var(--radius)] border border-primary/20 bg-primary/[0.04] p-4">
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {recoveryMessage}
                  </p>
                </div>
              )}

              {recoveryError && (
                <div className="mt-4 rounded-[var(--radius)] border border-destructive/20 bg-destructive/[0.04] p-4">
                  <p className="text-sm leading-relaxed text-destructive">
                    {recoveryError}
                  </p>
                </div>
              )}

              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Si vous ne recevez rien, si votre commande date de plus de quelques heures, ou si
                trop de tentatives ont déjà été effectuées, contactez-nous directement par téléphone
                ou par email.
              </p>
            </div>
          </div>
        </div>

        {loading && (
          <p className="mt-6 text-sm text-muted-foreground">
            Chargement des coordonnées…
          </p>
        )}
      </div>
    </ClientLayout>
  );
}